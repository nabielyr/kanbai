import "server-only";
import type { AiProvider } from "@/lib/ai/schemas";

export interface LlmPrompt {
  system: string;
  user: string;
}

/** A model behind an HTTP API. Returns the raw text; parsing is done by `normalize.ts`. */
export interface LlmProvider {
  name: AiProvider;
  generate(prompt: LlmPrompt, signal: AbortSignal): Promise<string>;
}

/**
 * Why a provider call failed:
 * - `rate_limited`: too many requests right now (try again in `retryAfterSec`)
 * - `quota_exhausted`: the daily free quota is used up
 * - `unavailable`: overloaded, 5xx or network trouble
 * - `timeout`: our time budget ran out
 * - `rejected`: the request itself was refused (bad key, unknown model, blocked prompt)
 */
export type ProviderFailure =
  "rate_limited" | "quota_exhausted" | "unavailable" | "timeout" | "rejected";

export class ProviderError extends Error {
  constructor(
    readonly provider: AiProvider,
    readonly kind: ProviderFailure,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

/** Maps an HTTP error status to a failure kind. */
export function failureFromStatus(
  provider: AiProvider,
  status: number,
  details: { message: string; retryAfterSec?: number; dailyQuota?: boolean },
): ProviderError {
  if (status === 429) {
    return details.dailyQuota
      ? new ProviderError(provider, "quota_exhausted", details.message)
      : new ProviderError(provider, "rate_limited", details.message, details.retryAfterSec);
  }
  if (status === 408) return new ProviderError(provider, "timeout", details.message);
  if (status >= 500) return new ProviderError(provider, "unavailable", details.message);
  return new ProviderError(provider, "rejected", `${status} ${details.message}`);
}

/**
 * Maps a thrown fetch error. Our own timeout becomes `timeout`; a cancelled request
 * (the user closed the dialog) is re-thrown untouched so callers can stop quietly.
 */
export function failureFromThrown(
  provider: AiProvider,
  error: unknown,
  signal: AbortSignal,
): never {
  if (error instanceof ProviderError) throw error;
  if (signal.aborted) {
    const reason: unknown = signal.reason;
    if (reason instanceof DOMException && reason.name === "TimeoutError") {
      throw new ProviderError(provider, "timeout", "timed out");
    }
    throw error;
  }
  throw new ProviderError(
    provider,
    "unavailable",
    error instanceof Error ? error.message : "network error",
  );
}

/** Parses "31s" / "1.5s" (Google RetryInfo) or "30" (Retry-After) into whole seconds. */
export function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const seconds = Number.parseFloat(String(value));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

/** Reads a JSON body, or null when it is missing or not JSON (e.g. an HTML error page). */
export async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
