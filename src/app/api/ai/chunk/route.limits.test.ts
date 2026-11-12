// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNKS_LEFT_HEADER, FREE_TRIES_HEADER } from "@/lib/ai/schemas";
import type { chunkTask } from "@/server/ai/chunk-service";
import type { Caller } from "@/server/caller";
import { createMemoryCounterStore, type CounterStore } from "@/server/counter-store";
import { POST } from "./route";

let caller: Caller;
let store: CounterStore;
const chunk = vi.fn<typeof chunkTask>();

vi.mock("@/server/caller", () => ({ identifyCaller: async () => caller }));
vi.mock("@/server/counter-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/counter-store")>()),
  getCounterStore: () => store,
}));
vi.mock("@/server/ai/chunk-service", () => ({
  createProviders: () => [],
  chunkTask: (...args: Parameters<typeof chunkTask>) => chunk(...args),
}));

const SUBTASKS = [
  { title: "Outline the sections", estimateMinutes: 20, order: 1 },
  { title: "Write the first draft", estimateMinutes: 60, order: 2 },
  { title: "Proofread and publish", estimateMinutes: 25, order: 3 },
];
const SUCCESS = { ok: true, response: { subtasks: SUBTASKS, provider: "gemini" } } as const;

const post = () =>
  POST(
    new Request("https://kanbai.app/api/ai/chunk", {
      method: "POST",
      headers: {
        origin: "https://kanbai.app",
        host: "kanbai.app",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
      },
      body: JSON.stringify({ title: "Write a blog post" }),
    }),
  );

beforeEach(() => {
  caller = { kind: "user", userId: "user-1" };
  store = createMemoryCounterStore();
  chunk.mockReset();
  chunk.mockResolvedValue(SUCCESS);
  vi.stubEnv("RATE_LIMIT_USER_PER_MINUTE", "2");
  vi.stubEnv("RATE_LIMIT_USER_PER_DAY", "5");
  vi.stubEnv("RATE_LIMIT_GLOBAL_PER_DAY", "100");
  vi.stubEnv("GUEST_FREE_CHUNKS", "3");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/ai/chunk rate limits", () => {
  it("answers a friendly 429 with Retry-After when someone spams, without calling the AI", async () => {
    const lefts = [];
    for (let i = 0; i < 2; i++) {
      const response = await post();
      expect(response.status).toBe(200);
      lefts.push(response.headers.get(CHUNKS_LEFT_HEADER));
    }
    expect(lefts).toEqual(["4", "3"]);

    const response = await post();
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toMatch(/Try again in \d+ seconds/);
    const retryAfter = Number(response.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(chunk).toHaveBeenCalledTimes(2);
  });

  it("stops at the daily limit with 0 chunks left", async () => {
    vi.stubEnv("RATE_LIMIT_USER_PER_MINUTE", "0");
    for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
    const response = await post();
    expect(response.status).toBe(429);
    expect(response.headers.get(CHUNKS_LEFT_HEADER)).toBe("0");
    expect((await response.json()).error.message).toMatch(/used your 5 chunks for today/);
  });

  it("reports an empty global budget as a quota problem (503)", async () => {
    vi.stubEnv("RATE_LIMIT_GLOBAL_PER_DAY", "1");
    expect((await post()).status).toBe(200);
    caller = { kind: "user", userId: "user-2" };
    const response = await post();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("QUOTA_EXHAUSTED");
  });

  it("doesn't use up a chunk when the AI fails", async () => {
    chunk.mockResolvedValue({
      ok: false,
      status: 502,
      body: { error: { code: "INVALID_AI_RESPONSE", message: "Odd." } },
    });
    const response = await post();
    expect(response.status).toBe(502);
    expect(response.headers.get(CHUNKS_LEFT_HEADER)).toBe("5");
  });

  it("doesn't use up a guest's free try when a limit turns them away", async () => {
    caller = { kind: "guest" };
    vi.stubEnv("RATE_LIMIT_USER_PER_MINUTE", "1");
    const ok = await post();
    expect(ok.status).toBe(200);
    expect(ok.headers.get(FREE_TRIES_HEADER)).toBe("2");
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(limited.headers.get(FREE_TRIES_HEADER)).toBe("2");
    expect(limited.headers.get(CHUNKS_LEFT_HEADER)).toBeNull();
  });

  it("keeps working for logged-in users when the counter is down", async () => {
    store = {
      add: async () => {
        throw new Error("down");
      },
      get: async () => {
        throw new Error("down");
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post()).status).toBe(200);
  });
});
