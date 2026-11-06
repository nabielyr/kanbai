// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_TRIES_HEADER, makeApiError } from "@/lib/ai/schemas";
import type { chunkTask } from "@/server/ai/chunk-service";
import type { Caller } from "@/server/caller";
import { createMemoryCounterStore, type CounterStore } from "@/server/counter-store";
import { DEVICE_COOKIE } from "@/server/guest-quota";
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

function post(cookie?: string) {
  return POST(
    new Request("https://kanbai.app/api/ai/chunk", {
      method: "POST",
      headers: {
        origin: "https://kanbai.app",
        host: "kanbai.app",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ title: "Write a blog post" }),
    }),
  );
}

beforeEach(() => {
  caller = { kind: "guest" };
  store = createMemoryCounterStore();
  chunk.mockReset();
  chunk.mockResolvedValue(SUCCESS);
  vi.stubEnv("GUEST_FREE_CHUNKS", "3");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/chunk guest quota", () => {
  it("gives 3 free tries, then asks to log in without calling the AI", async () => {
    const lefts = [];
    for (let i = 0; i < 3; i++) {
      const response = await post();
      expect(response.status).toBe(200);
      lefts.push(response.headers.get(FREE_TRIES_HEADER));
    }
    expect(lefts).toEqual(["2", "1", "0"]);

    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      makeApiError("LOGIN_REQUIRED", "You've used your 3 free chunks. Log in free to keep going."),
    );
    expect(response.headers.get(FREE_TRIES_HEADER)).toBe("0");
    expect(chunk).toHaveBeenCalledTimes(3);
  });

  it("asks to log in right away when guests get no free tries", async () => {
    vi.stubEnv("GUEST_FREE_CHUNKS", "0");
    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      makeApiError("LOGIN_REQUIRED", "Log in free to use Chunk it."),
    );
  });

  it("sets a device cookie for a new browser and keeps an existing one", async () => {
    const first = await post();
    const cookie = first.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(new RegExp(`^${DEVICE_COOKIE}=[0-9a-f-]{36}; .*HttpOnly`));
    expect(cookie).toContain("Secure");

    const again = await post(cookie.split(";")[0]);
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("doesn't count a try when the AI fails", async () => {
    chunk.mockResolvedValue({
      ok: false,
      status: 503,
      body: makeApiError("UNAVAILABLE", "AI isn't set up yet."),
    });
    const response = await post();
    expect(response.status).toBe(503);
    expect(response.headers.get(FREE_TRIES_HEADER)).toBe("3");

    chunk.mockResolvedValue(SUCCESS);
    expect((await post()).headers.get(FREE_TRIES_HEADER)).toBe("2");
  });

  it("answers UNAVAILABLE when the counter can't be reached", async () => {
    store = {
      add: async () => {
        throw new Error("down");
      },
      get: async () => [0],
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "UNAVAILABLE" } });
    expect(chunk).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/chunk for everyone else", () => {
  it.each<Caller>([{ kind: "user", userId: "user-1" }, { kind: "no-login" }])(
    "has no guest limit ($kind)",
    async (who) => {
      caller = who;
      vi.stubEnv("GUEST_FREE_CHUNKS", "0");
      const response = await post();
      expect(response.status).toBe(200);
      expect(response.headers.get(FREE_TRIES_HEADER)).toBeNull();
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
});
