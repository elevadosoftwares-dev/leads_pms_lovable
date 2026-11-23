import { convertToModelMessages, type UIMessage } from "ai";

import { getSessionUser } from "@/server/auth.server";
import { request as dbRequest, sql } from "@/server/db.server";
import { credentialDirectory } from "./directory.server";
import { createChatStream } from "./responses.server";

/** Signed-in, active user from the session cookie; rejects cross-site requests. */
async function authenticate(request: Request) {
  // Browsers label cross-site requests; this works behind a reverse proxy, unlike comparing URLs.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    throw Object.assign(new Error("Cross-site request blocked."), { status: 403 });
  const user = await getSessionUser();
  if (!user) throw Object.assign(new Error("Sign in to use the AI assistant."), { status: 401 });
  return user;
}

function errorResponse(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
  const message =
    error instanceof Error ? error.message : "The AI assistant could not answer right now.";
  return Response.json({ error: message }, { status });
}

async function saveConversation(userId: string, messages: UIMessage[]) {
  const req = await dbRequest();
  await req
    .input("user_id", sql.UniqueIdentifier, userId)
    // A failed reply leaves an empty assistant message; never store it, or it breaks later turns.
    .input(
      "messages",
      sql.NVarChar(sql.MAX),
      JSON.stringify(messages.filter((message) => message.parts.length > 0)),
    )
    .query(
      `UPDATE dbo.ai_chat_conversations
          SET messages = @messages, updated_at = SYSUTCDATETIME()
        WHERE user_id = @user_id;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.ai_chat_conversations (user_id, messages) VALUES (@user_id, @messages);`,
    );
}

export async function handleChat(request: Request) {
  try {
    const user = await authenticate(request);
    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages)) {
      return Response.json({ error: "Messages are required." }, { status: 400 });
    }

    const directory = await credentialDirectory(user);

    const instructions = [
      "You are Leads Assistant, the AI helper inside Leads Credential Manager.",
      `The signed-in person is ${user.email} in the ${user.department} department.`,
      "Answer questions about using the app, finding credentials, account controls, departments, entities, and credential hygiene.",
      "App map: Dashboard searches recent credentials; View Login Credentials lists and manages credentials; Masters is where administrators add entities and departments; User Management is where administrators create, edit, disable, or reset users; My Account changes the signed-in password; AI Assistant is this chat.",
      "Use the supplied non-secret credential directory when it helps. Never reveal, infer, or ask for passwords, tokens, keys, PINs, or secrets.",
      "If someone asks for a secret, explain that secrets stay hidden here and can be revealed manually on the credential details page.",
      "AI output is advisory only. Never claim that you created, changed, deleted, disabled, or reset anything.",
      "Keep answers concise and practical.",
      `Non-secret credential directory: ${JSON.stringify(directory)}`,
    ].join(" ");

    // Send only text history: earlier "Thinking" parts carry provider-specific encrypted data
    // that another model (or a changed AI_MODEL) rejects, and they add nothing to the context.
    const history = body.messages
      .map((message) => ({
        ...message,
        parts: message.parts.filter((part) => part.type === "text"),
      }))
      .filter((message) => message.parts.length > 0);
    const modelMessages = await convertToModelMessages(history);
    const stream = createChatStream(request, instructions, modelMessages);
    return stream.toResponse(body.messages, async ({ messages, isAborted }) => {
      if (isAborted) return;
      try {
        await saveConversation(user.userId, messages);
      } catch (error) {
        console.error("Could not save AI conversation", error);
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
