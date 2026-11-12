import {
  AI_ERROR_STATUS,
  apiErrorSchema,
  CHUNKS_LEFT_HEADER,
  chunkResponseSchema,
  FREE_TRIES_HEADER,
  quotaResponseSchema,
  type AiErrorCode,
  type ChunkRequestInput,
  type ChunkResponse,
  type QuotaResponse,
} from "./schemas";

// Browser side of "Chunk it". Components never call fetch themselves; they get a typed
// result back. Everything the server sends is validated again here.

export const CHUNK_ENDPOINT = "/api/ai/chunk";
export const QUOTA_ENDPOINT = "/api/ai/quota";

/** `NETWORK` is client-only: the request never reached the server. */
export type ChunkErrorCode = AiErrorCode | "NETWORK";

export interface ChunkError {
  code: ChunkErrorCode;
  message: string;
  retryAfterSec?: number;
}

export type ChunkClientResult = (
  { ok: true; data: ChunkResponse } | { ok: false; error: ChunkError }
) & {
  /** Set for guests: free tries left after this request. */
  freeTriesLeft?: number;
  /** Set for logged-in users: chunks left today after this request. */
  chunksLeftToday?: number;
};

function readCount(response: Response, header: string): number | undefined {
  const raw = response.headers.get(header);
  const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readCounts(response: Response) {
  const freeTriesLeft = readCount(response, FREE_TRIES_HEADER);
  const chunksLeftToday = readCount(response, CHUNKS_LEFT_HEADER);
  return {
    ...(freeTriesLeft === undefined ? {} : { freeTriesLeft }),
    ...(chunksLeftToday === undefined ? {} : { chunksLeftToday }),
  };
}

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

  const freeTries = readCounts(response);
  if (response.ok) {
    const parsed = chunkResponseSchema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data, ...freeTries }
      : {
          ok: false,
          error: {
            code: "INVALID_AI_RESPONSE",
            message: "The AI returned something odd. Please try again.",
          },
          ...freeTries,
        };
  }

  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) return { ok: false, error: parsed.data.error, ...freeTries };
  const retryAfter = Number(response.headers.get("retry-after"));
  return {
    ok: false,
    error: errorForStatus(
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    ),
    ...freeTries,
  };
}

/**
 * What this visitor has left: free tries (guest) or chunks today (logged in). A field is null
 * when no limit applies or it couldn't be checked. Never rejects: the badge is only a hint.
 */
export async function requestQuota(fetchImpl: typeof fetch = fetch): Promise<QuotaResponse> {
  const unknown: QuotaResponse = { freeTriesLeft: null, chunksLeftToday: null };
  try {
    const response = await fetchImpl(QUOTA_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return unknown;
    const parsed = quotaResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : unknown;
  } catch {
    return unknown;
  }
}
