import { z } from "zod";

// The "Chunk it" contract, shared by the browser and the server.
// Keep this file free of server-only imports: the client validates responses with it too.

export const DETAIL_LEVELS = ["brief", "medium", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const MIN_SUBTASKS = 3;
export const MAX_SUBTASKS = 8;
export const MIN_SUBTASK_TITLE = 3;
export const MAX_SUBTASK_TITLE = 120;
export const MIN_ESTIMATE_MINUTES = 5;
export const MAX_ESTIMATE_MINUTES = 480;

/** How many subtasks to ask for at each detail level (always within MIN..MAX_SUBTASKS). */
export const DETAIL_TARGETS: Record<DetailLevel, { min: number; max: number }> = {
  brief: { min: 3, max: 4 },
  medium: { min: 4, max: 6 },
  detailed: { min: 6, max: 8 },
};

export const MAX_CHUNK_TITLE = 200;
export const MAX_CHUNK_DESCRIPTION = 2000;

export const chunkRequestSchema = z.object({
  title: z.string().trim().min(1).max(MAX_CHUNK_TITLE),
  description: z.string().trim().max(MAX_CHUNK_DESCRIPTION).default(""),
  detail: z.enum(DETAIL_LEVELS).default("medium"),
});
/** What the client sends (description and detail may be left out). */
export type ChunkRequestInput = z.input<typeof chunkRequestSchema>;
/** What the server works with after validation. */
export type ChunkRequest = z.output<typeof chunkRequestSchema>;

export const subtaskSchema = z.object({
  title: z.string().min(MIN_SUBTASK_TITLE).max(MAX_SUBTASK_TITLE),
  estimateMinutes: z.number().int().min(MIN_ESTIMATE_MINUTES).max(MAX_ESTIMATE_MINUTES),
  /** 1-based position. */
  order: z.number().int().min(1),
});
export type Subtask = z.infer<typeof subtaskSchema>;

export const subtaskListSchema = z.array(subtaskSchema).min(MIN_SUBTASKS).max(MAX_SUBTASKS);

export const AI_PROVIDERS = ["gemini", "groq"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const chunkResponseSchema = z.object({
  subtasks: subtaskListSchema,
  provider: z.enum(AI_PROVIDERS),
});
export type ChunkResponse = z.infer<typeof chunkResponseSchema>;

// ---------- Errors ----------

export const AI_ERROR_CODES = [
  "VALIDATION",
  "LOGIN_REQUIRED",
  "RATE_LIMITED",
  "QUOTA_EXHAUSTED",
  "TIMEOUT",
  "INVALID_AI_RESPONSE",
  "UNAVAILABLE",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** HTTP status the API answers with for each error code. */
export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  VALIDATION: 400,
  LOGIN_REQUIRED: 401,
  RATE_LIMITED: 429,
  QUOTA_EXHAUSTED: 503,
  TIMEOUT: 504,
  INVALID_AI_RESPONSE: 502,
  UNAVAILABLE: 503,
};

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(AI_ERROR_CODES),
    message: z.string().max(500),
    retryAfterSec: z.number().int().min(0).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function makeApiError(code: AiErrorCode, message: string, retryAfterSec?: number): ApiError {
  return {
    error: retryAfterSec === undefined ? { code, message } : { code, message, retryAfterSec },
  };
}
