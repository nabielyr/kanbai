import "server-only";
import type { ServerEnv } from "./env";

// Counters that survive between requests. Serverless functions forget everything after each
// request, so production keeps them in Upstash Redis (free tier, REST API, no SDK needed).
// Without Upstash settings (local dev) they live in this process's memory instead.

export interface CounterStore {
  /** Adds `by` (may be negative) to each key and returns the new values, in order. */
  add(keys: string[], by: number, ttlSec: number): Promise<number[]>;
  /** Current values, 0 for keys that don't exist. */
  get(keys: string[]): Promise<number[]>;
}

export class CounterStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CounterStoreError";
  }
}

const UPSTASH_TIMEOUT_MS = 3000;

type UpstashReply = { result?: unknown; error?: string };

/** Talks to Upstash's REST API: one pipeline request per call. */
export function createUpstashCounterStore(options: {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}): CounterStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${options.url.replace(/\/+$/, "")}/pipeline`;

  async function pipeline(commands: string[][]): Promise<unknown[]> {
    let replies: unknown;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) throw new CounterStoreError(`Upstash answered ${response.status}`);
      replies = await response.json();
    } catch (error) {
      if (error instanceof CounterStoreError) throw error;
      throw new CounterStoreError("Couldn't reach Upstash", { cause: error });
    }
    if (!Array.isArray(replies) || replies.length !== commands.length) {
      throw new CounterStoreError("Unexpected reply from Upstash");
    }
    return replies.map((reply: UpstashReply) => {
      if (reply?.error) throw new CounterStoreError(`Upstash error: ${reply.error}`);
      return reply?.result;
    });
  }

  const toCount = (value: unknown) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    async add(keys, by, ttlSec) {
      const commands = keys.flatMap((key) => [
        ["INCRBY", key, String(by)],
        ["EXPIRE", key, String(ttlSec)],
      ]);
      const results = await pipeline(commands);
      return keys.map((_, i) => toCount(results[i * 2]));
    },
    async get(keys) {
      const [values] = await pipeline([["MGET", ...keys]]);
      if (!Array.isArray(values)) throw new CounterStoreError("Unexpected reply from Upstash");
      return keys.map((_, i) => toCount(values[i]));
    },
  };
}

/** Counters in memory, for local dev and tests. `now` makes expiry testable. */
export function createMemoryCounterStore(now: () => number = Date.now): CounterStore {
  const entries = new Map<string, { value: number; expiresAt: number }>();
  const read = (key: string) => {
    const entry = entries.get(key);
    if (!entry || entry.expiresAt <= now()) return 0;
    return entry.value;
  };

  return {
    async add(keys, by, ttlSec) {
      return keys.map((key) => {
        const value = read(key) + by;
        entries.set(key, { value, expiresAt: now() + ttlSec * 1000 });
        return value;
      });
    },
    async get(keys) {
      return keys.map(read);
    },
  };
}

let memoryStore: CounterStore | null = null;

/** Upstash when it's set up, otherwise one shared in-memory store (with a warning). */
export function getCounterStore(env: ServerEnv): CounterStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashCounterStore({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  if (!memoryStore) {
    console.warn(
      "[kanbai] UPSTASH_REDIS_REST_URL/TOKEN aren't set: AI usage is counted in memory, " +
        "which resets on restart and isn't shared between server instances.",
    );
    memoryStore = createMemoryCounterStore();
  }
  return memoryStore;
}
