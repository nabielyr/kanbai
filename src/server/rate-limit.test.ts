// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMemoryCounterStore } from "./counter-store";
import { getChunksLeftToday, rateLimitMessage, reserveChunk, type RateLimits } from "./rate-limit";

const LIMITS: RateLimits = { perMinute: 2, perDay: 4, globalPerDay: 100 };
// 2026-11-12 10:00:15 UTC: 45 s to the next minute, 14 h to the next day.
const NOW = Date.UTC(2026, 10, 12, 10, 0, 15);

describe("reserveChunk", () => {
  it("counts down the day and stops at the per-minute limit with the seconds left", async () => {
    const store = createMemoryCounterStore(() => NOW);
    expect(await reserveChunk(store, "user:a", LIMITS, NOW)).toMatchObject({
      ok: true,
      leftToday: 3,
    });
    expect(await reserveChunk(store, "user:a", LIMITS, NOW)).toMatchObject({ leftToday: 2 });

    expect(await reserveChunk(store, "user:a", LIMITS, NOW)).toEqual({
      ok: false,
      scope: "minute",
      retryAfterSec: 45,
    });
    // The turned-away request used nothing, and the next minute works again.
    expect(await getChunksLeftToday(store, "user:a", LIMITS, NOW)).toBe(2);
    expect(await reserveChunk(store, "user:a", LIMITS, NOW + 60_000)).toMatchObject({
      ok: true,
      leftToday: 1,
    });
  });

  it("stops at the daily limit and says when it resets", async () => {
    const store = createMemoryCounterStore(() => NOW);
    const limits = { ...LIMITS, perMinute: 0 };
    for (let i = 0; i < 4; i++) await reserveChunk(store, "user:a", limits, NOW);
    expect(await reserveChunk(store, "user:a", limits, NOW)).toEqual({
      ok: false,
      scope: "day",
      retryAfterSec: 14 * 3600 - 15,
    });
    expect(await getChunksLeftToday(store, "user:a", limits, NOW)).toBe(0);
    expect(await reserveChunk(store, "user:a", limits, NOW + 24 * 3600_000)).toMatchObject({
      ok: true,
    });
  });

  it("keeps people apart but shares the global budget", async () => {
    const store = createMemoryCounterStore(() => NOW);
    const limits: RateLimits = { perMinute: 0, perDay: 5, globalPerDay: 2 };
    expect(await reserveChunk(store, "user:a", limits, NOW)).toMatchObject({ ok: true });
    expect(await reserveChunk(store, "user:b", limits, NOW)).toMatchObject({ ok: true });
    expect(await reserveChunk(store, "user:c", limits, NOW)).toMatchObject({
      ok: false,
      scope: "global",
    });
    // Being turned away by the global budget didn't use up user c's day.
    expect(await getChunksLeftToday(store, "user:c", limits, NOW)).toBe(5);
  });

  it("refund gives back the day and global count once, but not the minute", async () => {
    const store = createMemoryCounterStore(() => NOW);
    const limits: RateLimits = { perMinute: 1, perDay: 3, globalPerDay: 10 };
    const taken = await reserveChunk(store, "user:a", limits, NOW);
    if (!taken.ok) throw new Error("expected a reservation");
    await taken.refund();
    await taken.refund();
    expect(await getChunksLeftToday(store, "user:a", limits, NOW)).toBe(3);
    expect(await reserveChunk(store, "user:a", limits, NOW)).toMatchObject({
      ok: false,
      scope: "minute",
    });
  });

  it("treats 0 as off", async () => {
    const store = createMemoryCounterStore(() => NOW);
    const off: RateLimits = { perMinute: 0, perDay: 0, globalPerDay: 0 };
    for (let i = 0; i < 20; i++) {
      expect(await reserveChunk(store, "user:a", off, NOW)).toMatchObject({
        ok: true,
        leftToday: null,
      });
    }
    expect(await getChunksLeftToday(store, "user:a", off, NOW)).toBeNull();
  });
});

describe("rateLimitMessage", () => {
  it("is friendly and says how long to wait", () => {
    expect(rateLimitMessage("minute", LIMITS, 45)).toBe(
      "That's a lot of chunks at once. Try again in 45 seconds.",
    );
    expect(rateLimitMessage("day", LIMITS, 14 * 3600)).toBe(
      "You've used your 4 chunks for today. They come back in about 14 hours.",
    );
    expect(rateLimitMessage("global", LIMITS, 300)).toContain("about 5 minutes");
  });
});
