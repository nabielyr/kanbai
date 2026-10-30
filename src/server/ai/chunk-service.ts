import "server-only";
import { normalizeChunkOutput } from "@/lib/ai/normalize";
import {
  AI_ERROR_STATUS,
  makeApiError,
  type AiErrorCode,
  type ApiError,
  type ChunkRequest,
  type ChunkResponse,
} from "@/lib/ai/schemas";
import type { ServerEnv } from "@/server/env";
import { createGeminiProvider } from "./gemini";
import { buildChunkPrompt } from "./prompts";
import { ProviderError, type LlmProvider } from "./provider";

export type ChunkResult =
  { ok: true; response: ChunkResponse } | { ok: false; status: number; body: ApiError };

/** The configured providers, in the order they are tried. */
export function createProviders(env: ServerEnv, fetchImpl?: typeof fetch): LlmProvider[] {
  const providers: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) {
    providers.push(
      createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl }),
    );
  }
  return providers;
}

function fail(code: AiErrorCode, message: string, retryAfterSec?: number): ChunkResult {
  return {
    ok: false,
    status: AI_ERROR_STATUS[code],
    body: makeApiError(code, message, retryAfterSec),
  };
}

/** Friendly, non-technical messages; details only go to the server log. */
function failureToResult(error: ProviderError): ChunkResult {
  switch (error.kind) {
    case "rate_limited":
      return fail(
        "RATE_LIMITED",
        "The AI is busy right now. Try again in a moment.",
        error.retryAfterSec,
      );
    case "quota_exhausted":
      return fail("QUOTA_EXHAUSTED", "Today's free AI quota is used up. It resets tomorrow.");
    case "timeout":
      return fail("TIMEOUT", "That took too long. Please try again.");
    default:
      return fail("UNAVAILABLE", "The AI is unavailable right now. Please try again later.");
  }
}

/** Asks the AI to break a task into subtasks and returns a validated, normalized result. */
export async function chunkTask(
  request: ChunkRequest,
  deps: { providers: LlmProvider[]; signal: AbortSignal },
): Promise<ChunkResult> {
  const provider = deps.providers[0];
  if (!provider) return fail("UNAVAILABLE", "AI isn't set up on this server yet.");

  try {
    const raw = await provider.generate(buildChunkPrompt(request), deps.signal);
    const normalized = normalizeChunkOutput(raw);
    if (!normalized.ok) {
      console.warn(`[chunk] ${provider.name} returned unusable output: ${normalized.reason}`);
      return fail("INVALID_AI_RESPONSE", "The AI returned something odd. Please try again.");
    }
    return { ok: true, response: { subtasks: normalized.subtasks, provider: provider.name } };
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    console.warn(`[chunk] ${error.message} (${error.kind})`);
    return failureToResult(error);
  }
}
