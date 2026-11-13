// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/server/caller";
import { createMemoryCounterStore, type CounterStore } from "@/server/counter-store";
import { readGuestIdentity, reserveGuestTry } from "@/server/guest-quota";
import { GET } from "./route";

let caller: Caller;
let store: CounterStore;

vi.mock("@/server/caller", () => ({ identifyCaller: async () => caller }));
vi.mock("@/server/counter-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/counter-store")>()),
  getCounterStore: () => store,
}));

const FORWARDED = { "x-forwarded-for": "203.0.113.7" };
const get = () => GET(new Request("https://kanbai.app/api/ai/quota", { headers: FORWARDED }));

const NO_LIMIT = { freeTriesLeft: null, chunksLeftToday: null };

beforeEach(() => {
  caller = { kind: "guest" };
  store = createMemoryCounterStore();
  vi.stubEnv("GUEST_FREE_CHUNKS", "3");
  vi.stubEnv("RATE_LIMIT_USER_PER_DAY", "30");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/ai/quota", () => {
  it("tells a guest how many free tries are left, without using one", async () => {
    const first = await get();
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({ freeTriesLeft: 3, chunksLeftToday: null });
    expect(await (await get()).json()).toEqual({ freeTriesLeft: 3, chunksLeftToday: null });
  });

  it("counts down with the guest's real usage", async () => {
    const identity = await readGuestIdentity(new Headers(FORWARDED), "");
    await reserveGuestTry(store, identity, 3);
    expect(await (await get()).json()).toEqual({ freeTriesLeft: 2, chunksLeftToday: null });
  });

  it("tells a logged-in user how many chunks are left today", async () => {
    caller = { kind: "user", userId: "user-1" };
    expect(await (await get()).json()).toEqual({ freeTriesLeft: null, chunksLeftToday: 30 });
  });

  it("reports no limit when login isn't set up", async () => {
    caller = { kind: "no-login" };
    expect(await (await get()).json()).toEqual(NO_LIMIT);
  });

  it("reports no limit, not an error, when the counter is down", async () => {
    store = {
      add: async () => [],
      get: async () => {
        throw new Error("down");
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(NO_LIMIT);
  });
});
