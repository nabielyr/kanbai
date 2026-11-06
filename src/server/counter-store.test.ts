// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CounterStoreError,
  createMemoryCounterStore,
  createUpstashCounterStore,
} from "./counter-store";

describe("createMemoryCounterStore", () => {
  it("adds to counters, reads missing ones as 0, and forgets them after the TTL", async () => {
    let now = 0;
    const store = createMemoryCounterStore(() => now);

    expect(await store.add(["a", "b"], 1, 60)).toEqual([1, 1]);
    expect(await store.add(["a"], 2, 60)).toEqual([3]);
    expect(await store.add(["a"], -1, 60)).toEqual([2]);
    expect(await store.get(["a", "b", "c"])).toEqual([2, 1, 0]);

    now = 61_000;
    expect(await store.get(["a", "b"])).toEqual([0, 0]);
  });
});

describe("createUpstashCounterStore", () => {
  const reply = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>(async () => Response.json(body, { status }));

  it("sends INCRBY + EXPIRE per key in one pipeline request", async () => {
    const fetchImpl = reply([{ result: 2 }, { result: 1 }, { result: 4 }, { result: 1 }]);
    const store = createUpstashCounterStore({
      url: "https://fine-cat.upstash.io/",
      token: "secret",
      fetchImpl,
    });

    expect(await store.add(["a", "b"], 1, 60)).toEqual([2, 4]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://fine-cat.upstash.io/pipeline");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    expect(JSON.parse(String(init?.body))).toEqual([
      ["INCRBY", "a", "1"],
      ["EXPIRE", "a", "60"],
      ["INCRBY", "b", "1"],
      ["EXPIRE", "b", "60"],
    ]);
  });

  it("reads counters with MGET, treating missing keys as 0", async () => {
    const fetchImpl = reply([{ result: ["3", null] }]);
    const store = createUpstashCounterStore({ url: "https://x.upstash.io", token: "t", fetchImpl });

    expect(await store.get(["a", "b"])).toEqual([3, 0]);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual([["MGET", "a", "b"]]);
  });

  it("throws a CounterStoreError for HTTP errors, command errors and network failures", async () => {
    const url = "https://x.upstash.io";
    await expect(
      createUpstashCounterStore({ url, token: "t", fetchImpl: reply({}, 401) }).get(["a"]),
    ).rejects.toBeInstanceOf(CounterStoreError);
    await expect(
      createUpstashCounterStore({
        url,
        token: "t",
        fetchImpl: reply([{ error: "WRONGTYPE" }, { result: 1 }]),
      }).add(["a"], 1, 60),
    ).rejects.toThrow("WRONGTYPE");
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      createUpstashCounterStore({ url, token: "t", fetchImpl: offline }).get(["a"]),
    ).rejects.toBeInstanceOf(CounterStoreError);
  });
});
