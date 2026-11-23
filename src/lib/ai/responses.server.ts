import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage, type UIMessage } from "ai";
import type { z } from "zod";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const GATEWAY_MODEL = "openai/gpt-6-astra";

/**
 * AI settings from the environment. Either:
 *  - AI_API_KEY (+ optional AI_BASE_URL, AI_MODEL) for any OpenAI-compatible Responses API
 *    (defaults to api.openai.com), or
 *  - LOVABLE_API_KEY to use the Lovable AI gateway.
 */
function getConfig() {
  const apiKey = process.env["AI_API_KEY"]?.trim();
  if (apiKey) {
    return {
      baseURL: process.env["AI_BASE_URL"]?.trim() || "https://api.openai.com/v1",
      apiKey,
      model: process.env["AI_MODEL"]?.trim() || "gpt-4.1-mini",
      lovable: false,
    };
  }
  const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
  if (lovableKey) {
    return {
      baseURL: GATEWAY_URL,
      apiKey: lovableKey,
      model: process.env["AI_MODEL"]?.trim() || GATEWAY_MODEL,
      lovable: true,
    };
  }
  throw new Error("AI is not configured on this server. Set AI_API_KEY in the .env file.");
}

function createProvider(request: Request) {
  const config = getConfig();
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    ...(config.lovable
      ? {
          headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        }
      : {}),
  });
  return { config, provider, runIdFetch };
}

/** Reasoning models (gpt-5*, o1/o3/o4*, gateway "openai/gpt-6…") accept reasoning settings. */
function isReasoningModel(model: string) {
  return /^(openai\/)?(gpt-[5-9]|o\d)/i.test(model);
}

/** Non-reasoning models such as gpt-4.1-mini reject reasoning options, so send them only when supported. */
function providerOptionsFor(model: string) {
  return {
    openai: isReasoningModel(model)
      ? {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        }
      : { store: false },
  } as const;
}

export async function generateStructured<T>(
  request: Request,
  instructions: string,
  messages: ModelMessage[],
  schema: z.ZodType<T>,
) {
  const { config, provider } = createProvider(request);
  const result = streamText({
    model: provider.responses(config.model),
    instructions,
    messages,
    output: Output.object({ schema }),
    providerOptions: providerOptionsFor(config.model),
    abortSignal: request.signal,
    maxRetries: 0,
  });
  return await result.output;
}

export function createChatStream(request: Request, instructions: string, messages: ModelMessage[]) {
  const { config, provider, runIdFetch } = createProvider(request);
  const result = streamText({
    model: provider.responses(config.model),
    instructions,
    messages,
    providerOptions: providerOptionsFor(config.model),
    abortSignal: request.signal,
    maxRetries: 0,
    onError: ({ error }) => console.error("[ai] Chat request failed:", error),
  });

  return {
    result,
    toResponse: async (
      originalMessages: UIMessage[],
      onEnd?: (event: { messages: UIMessage[]; isAborted: boolean }) => Promise<void> | void,
    ) => {
      const response = result.toUIMessageStreamResponse({
        originalMessages,
        sendReasoning: true,
        // The SDK hides errors as "An error occurred."; show the provider's message instead
        // (e.g. invalid key, quota, unknown model). It never contains the API key.
        onError: (error) =>
          `The AI assistant could not answer: ${error instanceof Error ? error.message : String(error)}`,
        ...(onEnd ? { onEnd } : {}),
      });
      // The run-ID header only exists on the Lovable gateway. Waiting for it with any other
      // provider would hold the response forever, so other providers stream directly.
      return config.lovable ? withLovableAiGatewayRunIdHeader(response, runIdFetch) : response;
    },
  };
}
