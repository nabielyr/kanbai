import {
  AI_ERROR_STATUS,
  apiErrorSchema,
  chunkResponseSchema,
  type AiErrorCode,
  type ChunkRequestInput,
  type ChunkResponse,
} from "./schemas";

// Browser side of "Chunk it". Components never call fetch themselves; they get a typed
// result back. Everything the server sends is validated again here.

export const CHUNK_ENDPOINT = "/api/ai/chunk";

/** `NETWORK` is client-only: the request never reached the server. */
export type ChunkErrorCode = AiErrorCode | "NETWORK";

export interface ChunkError {
  code: ChunkErrorCode;
  message: string;
  retryAfterSec?: number;
}

export type ChunkClientResult =
  { ok: true; data: ChunkResponse } | { ok: false; error: ChunkError };

/** Used when the server's answer can't be read (e.g. a proxy's HTML error page). */
function errorForStatus(status: number, retryAfterSec?: number): ChunkError {
  const code =
    (Object.keys(AI_ERROR_STATUS) as AiErrorCode[]).find(
      (c) => AI_ERROR_STATUS[c] === status && c !== "QUOTA_EXHAUSTED",
    ) ?? "UNAVAILABLE";
  return { code, message: "Something went wrong. Please try again.", retryAfterSec };
}

/**
 * Asks the server to chunk a task. Resolves with a typed result for every server answer;
 * rejects only when `signal` is aborted (the user cancelled), so callers can ignore it.
 */
export async function requestChunk(
  input: ChunkRequestInput,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChunkClientResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(CHUNK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      ok: false,
      error: { code: "NETWORK", message: "Couldn't reach KanbAI. Check your connection." },
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }

  if (response.ok) {
    const parsed = chunkResponseSchema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : {
          ok: false,
          error: {
            code: "INVALID_AI_RESPONSE",
            message: "The AI returned something odd. Please try again.",
          },
        };
  }

  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) return { ok: false, error: parsed.data.error };
  const retryAfter = Number(response.headers.get("retry-after"));
  return {
    ok: false,
    error: errorForStatus(
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    ),
  };
}
