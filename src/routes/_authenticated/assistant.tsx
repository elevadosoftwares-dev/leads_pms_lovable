import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { clearAiConversation, getAiConversation } from "@/lib/ai.functions";
import { useSession } from "@/lib/session";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant | Leads Credential Manager" },
      {
        name: "description",
        content:
          "Ask the Leads AI assistant for credential search help, security guidance, and app support.",
      },
      { property: "og:title", content: "AI Assistant | Leads Credential Manager" },
      {
        property: "og:description",
        content:
          "Ask the Leads AI assistant for credential search help, security guidance, and app support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { data: session } = useSession();
  const fetchConversation = useServerFn(getAiConversation);
  const { data: conversation, isLoading } = useQuery({
    queryKey: ["ai-conversation"],
    queryFn: () => fetchConversation(),
    enabled: !!session?.userId,
  });

  if (!session?.userId || isLoading) {
    return <p className="text-sm text-muted-foreground">Loading AI assistant…</p>;
  }

  return (
    <AssistantChat
      key={session.userId}
      userId={session.userId}
      initialMessages={(conversation ?? []) as unknown as UIMessage[]}
    />
  );
}

function AssistantChat({
  userId,
  initialMessages,
}: {
  userId: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const clearConversation = useServerFn(clearAiConversation);
  const transport = useMemo(
    () =>
      // The session cookie authenticates the request; no token handling is needed here.
      new DefaultChatTransport({ api: "/api/chat", credentials: "same-origin" }),
    [],
  );
  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useChat({
    id: `leads-assistant-${userId}`,
    messages: initialMessages,
    transport,
    onError: (chatError) => toast.error(chatErrorText(chatError)),
  });

  const clear = useMutation({
    mutationFn: () => clearConversation(),
    onSuccess: () => {
      setMessages([]);
      clearError();
      queryClient.invalidateQueries({ queryKey: ["ai-conversation"] });
      toast.success("AI conversation cleared.");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Leads AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              One saved conversation. Passwords, tokens, and keys are never sent to AI.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (window.confirm("Clear your saved AI conversation?")) clear.mutate();
          }}
          disabled={clear.isPending || messages.length === 0}
        >
          <Trash2 className="size-4" /> Clear Conversation
        </Button>
      </div>

      <Conversation className="vault-surface rounded-2xl border border-border">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<KeyRound className="size-8" />}
              title="Ask Leads Assistant"
              description="Try: “Find credentials for our banking portal”, “How do I add a department?”, or “Which entries look incomplete?”"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={`${message.id}-text-${index}`}>
                          {part.text}
                        </MessageResponse>
                      );
                    }
                    if (part.type === "reasoning" && part.text) {
                      return (
                        <details
                          key={`${message.id}-reasoning-${index}`}
                          className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                        >
                          <summary className="cursor-pointer font-medium">Thinking</summary>
                          <p className="mt-2 whitespace-pre-wrap">{part.text}</p>
                        </details>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Thinking…</Shimmer>}
          {error && <p className="text-sm text-destructive">{chatErrorText(error)}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        onSubmit={(message) => {
          const text = message.text.trim();
          if (!text || busy) return;
          clearError();
          void sendMessage({ text });
        }}
      >
        <PromptInputTextarea
          autoFocus
          placeholder="Ask about credentials, security hygiene, or how to use the app…"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

/** The chat endpoint answers errors as {"error": "..."}; show just the message. */
function chatErrorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON - use the message as is.
  }
  return error.message || "The AI assistant could not answer right now.";
}
