import "server-only";
import { z } from "zod";

// The only place that reads secrets. Nothing here has a NEXT_PUBLIC_ prefix, and the
// "server-only" import makes the build fail if client code ever imports this file.

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverEnvSchema = z.object({
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-2.5-flash"),
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: z.string().trim().min(1).default("llama-3.3-70b-versatile"),
  UPSTASH_REDIS_REST_URL: z.url({ protocol: /^https?$/ }).optional(),
  UPSTASH_REDIS_REST_TOKEN: optionalSecret,
  /** Mixed into IP hashes so the stored hashes can't be matched back to addresses. */
  IP_HASH_SALT: z.string().default(""),
  GUEST_FREE_CHUNKS: z.coerce.number().int().min(0).max(100).default(3),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Reads and validates the server environment. Called per request (it's cheap), so a missing
 * key turns into a clean "AI unavailable" error instead of crashing the build or the server.
 */
export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  // Empty values from .env ("GEMINI_MODEL=") should fall back to the defaults.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
  return serverEnvSchema.parse(cleaned);
}
