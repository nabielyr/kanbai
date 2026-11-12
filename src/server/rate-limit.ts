import "server-only";
import type { CounterStore } from "./counter-store";
import type { ServerEnv } from "./env";

// Limits on "Chunk it" so one person can't burn the shared free AI quota. Three fixed
// windows, all counted in the same store as the guest tries: per person per minute (stops
// button mashing), per person per day, and one global budget per day for everybody.

export interface RateLimits {
  perMinute: number;
  perDay: number;
  globalPerDay: number;
}

/** 0 turns a limit off. */
export function rateLimitsFromEnv(env: ServerEnv): RateLimits {
  return {
    perMinute: env.RATE_LIMIT_USER_PER_MINUTE,
    perDay: env.RATE_LIMIT_USER_PER_DAY,
    globalPerDay: env.RATE_LIMIT_GLOBAL_PER_DAY,
  };
}

export type RateLimitScope = "minute" | "day" | "global";

export type RateReservation =
  | {
      ok: true;
      /** Chunks this person has left today, or null when the daily limit is off. */
      leftToday: number | null;
      /** Gives the daily and global count back (the AI didn't produce anything). */
      refund: () => Promise<void>;
    }
  | { ok: false; scope: RateLimitScope; retryAfterSec: number };

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A person: a user id when logged in, otherwise the salted IP hash. */
export const userSubject = (userId: string) => `user:${userId}`;
export const guestSubject = (ipHash: string) => `ip:${ipHash}`;

interface Window {
  scope: RateLimitScope;
  key: string;
  limit: number;
  ttlSec: number;
  retryAfterSec: number;
  /** Given back when the request produced nothing. The minute window never is. */
  refundable: boolean;
}

function windows(subject: string, limits: RateLimits, now: number): Window[] {
  const minute = Math.floor(now / MINUTE_MS);
  const day = Math.floor(now / DAY_MS);
  const secondsLeft = (windowMs: number, index: number) =>
    Math.max(1, Math.ceil(((index + 1) * windowMs - now) / 1000));
  const all: Window[] = [
    {
      scope: "minute",
      key: `kanbai:rl:min:${subject}:${minute}`,
      limit: limits.perMinute,
      ttlSec: 2 * 60,
      retryAfterSec: secondsLeft(MINUTE_MS, minute),
      refundable: false,
    },
    {
      scope: "day",
      key: `kanbai:rl:day:${subject}:${day}`,
      limit: limits.perDay,
      ttlSec: 2 * 24 * 60 * 60,
      retryAfterSec: secondsLeft(DAY_MS, day),
      refundable: true,
    },
    {
      scope: "global",
      key: `kanbai:rl:global:${day}`,
      limit: limits.globalPerDay,
      ttlSec: 2 * 24 * 60 * 60,
      retryAfterSec: secondsLeft(DAY_MS, day),
      refundable: true,
    },
  ];
  return all.filter((w) => w.limit > 0);
}

/**
 * Takes one chunk from every limit before the AI runs, so parallel requests can't slip past.
 * A request that is turned away leaves no trace in any count.
 */
export async function reserveChunk(
  store: CounterStore,
  subject: string,
  limits: RateLimits,
  now: number = Date.now(),
): Promise<RateReservation> {
  const taken: Window[] = [];
  let dayCount: number | null = null;

  const giveBack = async (list: Window[]) => {
    for (const w of list) {
      try {
        await store.add([w.key], -1, w.ttlSec);
      } catch (error) {
        // The person loses one chunk at worst.
        console.error("[kanbai] Couldn't give back a chunk", error);
      }
    }
  };

  for (const w of windows(subject, limits, now)) {
    let count: number | undefined;
    try {
      [count] = await store.add([w.key], 1, w.ttlSec);
    } catch (error) {
      await giveBack(taken);
      throw error;
    }
    if (count === undefined || count > w.limit) {
      await giveBack([...taken, w]);
      return { ok: false, scope: w.scope, retryAfterSec: w.retryAfterSec };
    }
    taken.push(w);
    if (w.scope === "day") dayCount = count;
  }

  let refunded = false;
  return {
    ok: true,
    leftToday: dayCount === null ? null : limits.perDay - dayCount,
    refund: async () => {
      if (refunded) return;
      refunded = true;
      await giveBack(taken.filter((w) => w.refundable));
    },
  };
}

/** Chunks left today for the badge, or null when the daily limit is off. Changes nothing. */
export async function getChunksLeftToday(
  store: CounterStore,
  subject: string,
  limits: RateLimits,
  now: number = Date.now(),
): Promise<number | null> {
  const day = windows(subject, limits, now).find((w) => w.scope === "day");
  if (!day) return null;
  const [used] = await store.get([day.key]);
  return Math.max(0, day.limit - (used ?? 0));
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minutes`;
  return `${Math.ceil(minutes / 60)} hours`;
}

/** What to tell the person when a limit stops them. */
export function rateLimitMessage(
  scope: RateLimitScope,
  limits: RateLimits,
  retryAfterSec: number,
): string {
  switch (scope) {
    case "minute":
      return `That's a lot of chunks at once. Try again in ${formatWait(retryAfterSec)}.`;
    case "day":
      return `You've used your ${limits.perDay} chunks for today. They come back in about ${formatWait(retryAfterSec)}.`;
    case "global":
      return `KanbAI's free AI budget for today is used up. It comes back in about ${formatWait(retryAfterSec)}.`;
  }
}
