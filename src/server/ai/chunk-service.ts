import "server-only";
import { normalizeChunkOutput } from "@/lib/ai/normalize";
import {
  AI_ERROR_STATUS,
  makeApiError,
  type AiErrorCode,
  type ApiError,
  type ChunkRequest,
  type ChunkResponse,
  type Subtask,
} from "@/lib/ai/schemas";
import type { ServerEnv } from "@/server/env";
import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import { buildChunkPrompt } from "./prompts";
import { ProviderError, type LlmProvider, type ProviderFailure } from "./provider";

export type ChunkResult =
  { ok: true; response: ChunkResponse } | { ok: false; status: number; body: ApiError };

/** Time budget per provider, shared by its first attempt and the JSON retry. */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** The configured providers, in the order they are tried: Gemini first, then Groq. */
export function createProviders(env: ServerEnv, fetchImpl?: typeof fetch): LlmProvider[] {
  const providers: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) {
    providers.push(
      createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl }),
    );
  }
  if (env.GROQ_API_KEY) {
    providers.push(
      createGroqProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, fetchImpl }),
    );
  }
  return providers;
}

/** One failed provider: a provider error, or output that stayed unusable after the retry. */
type ProviderFailureInfo = { kind: ProviderFailure; retryAfterSec?: number };
type Failure = ProviderFailureInfo | { kind: "invalid" };

const isProviderFailure = (f: Failure): f is ProviderFailureInfo => f.kind !== "invalid";

function fail(code: AiErrorCode, message: string, retryAfterSec?: number): ChunkResult {
  return {
    ok: false,
    status: AI_ERROR_STATUS[code],
    body: makeApiError(code, message, retryAfterSec),
  };
}

/**
 * Picks the most useful message when every provider failed:
 * a short wait beats "try later", and "quota used up" is only said when it's true for all.
 */
export function summarizeFailures(failures: Failure[]): ChunkResult {
  const real = failures.filter(isProviderFailure);
  if (real.length === 0) {
    return fail("INVALID_AI_RESPONSE", "The AI returned something odd. Please try again.");
  }

  const rateLimited = real.filter((f) => f.kind === "rate_limited");
  if (rateLimited.length > 0) {
    const waits = rateLimited.flatMap((f) =>
      f.retryAfterSec === undefined ? [] : [f.retryAfterSec],
    );
    return fail(
      "RATE_LIMITED",
      "The AI is busy right now. Try again in a moment.",
      waits.length > 0 ? Math.min(...waits) : undefined,
    );
  }
  if (real.every((f) => f.kind === "quota_exhausted")) {
    return fail(
      "QUOTA_EXHAUSTED",
      "Today's free AI quota is used up. It resets tomorrow — you can still add subtasks by hand.",
    );
  }
  if (real.some((f) => f.kind === "timeout")) {
    return fail("TIMEOUT", "That took too long. Please try again.");
  }
  return fail("UNAVAILABLE", "The AI is unavailable right now. Please try again later.");
}

/** Asks one provider, retrying once with a JSON reminder when the output is unusable. */
async function askProvider(
  provider: LlmProvider,
  request: ChunkRequest,
  signal: AbortSignal,
): Promise<{ ok: true; subtasks: Subtask[] } | { ok: false; failure: Failure }> {
  for (const reminder of [false, true]) {
    try {
      const raw = await provider.generate(buildChunkPrompt(request, { reminder }), signal);
      const normalized = normalizeChunkOutput(raw);
      if (normalized.ok) return { ok: true, subtasks: normalized.subtasks };
      console.warn(`[chunk] ${provider.name} returned unusable output: ${normalized.reason}`);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      console.warn(`[chunk] ${error.message} (${error.kind})`);
      return { ok: false, failure: { kind: error.kind, retryAfterSec: error.retryAfterSec } };
    }
  }
  return { ok: false, failure: { kind: "invalid" } };
}

/**
 * Breaks a task into subtasks: tries each provider in turn (falling back on any failure),
 * each within its own time budget. A cancelled request is re-thrown so the route can stop.
 */
export async function chunkTask(
  request: ChunkRequest,
  deps: { providers: LlmProvider[]; signal: AbortSignal; timeoutMs?: number },
): Promise<ChunkResult> {
  if (deps.providers.length === 0) {
    return fail("UNAVAILABLE", "AI isn't set up on this server yet.");
  }

  const failures: Failure[] = [];
  for (const provider of deps.providers) {
    const signal = AbortSignal.any([
      deps.signal,
      AbortSignal.timeout(deps.timeoutMs ?? PROVIDER_TIMEOUT_MS),
    ]);
    const result = await askProvider(provider, request, signal);
    if (result.ok)
      return { ok: true, response: { subtasks: result.subtasks, provider: provider.name } };
    deps.signal.throwIfAborted();
    failures.push(result.failure);
  }
  return summarizeFailures(failures);
}
