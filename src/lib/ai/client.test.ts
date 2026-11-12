// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CHUNK_ENDPOINT, QUOTA_ENDPOINT, requestChunk, requestQuota } from "./client";
import { CHUNKS_LEFT_HEADER, FREE_TRIES_HEADER, makeApiError } from "./schemas";

const SUBTASKS = [
  { title: "Outline the sections", estimateMinutes: 20, order: 1 },
  { title: "Write the first draft", estimateMinutes: 60, order: 2 },
  { title: "Proofread and publish", estimateMinutes: 25, order: 3 },
];

const fetchReturning = (response: Response | Error) =>
  vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });

describe("requestChunk", () => {
  it("posts the task as JSON and returns the validated response", async () => {
    const fetchImpl = fetchReturning(Response.json({ subtasks: SUBTASKS, provider: "gemini" }));
    const result = await requestChunk({ title: "Write a post", detail: "brief" }, { fetchImpl });

    expect(result).toEqual({ ok: true, data: { subtasks: SUBTASKS, provider: "gemini" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CHUNK_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ title: "Write a post", detail: "brief" });
  });

  it("rejects a success response that doesn't match the contract", async () => {
    const fetchImpl = fetchReturning(Response.json({ subtasks: [], provider: "gemini" }));
    const result = await requestChunk({ title: "x" }, { fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_AI_RESPONSE" } });
  });

  it("passes the server's error through", async () => {
    const body = makeApiError("RATE_LIMITED", "The AI is busy right now.", 20);
    const fetchImpl = fetchReturning(Response.json(body, { status: 429 }));
    expect(await requestChunk({ title: "x" }, { fetchImpl })).toEqual({
      ok: false,
      error: body.error,
    });
  });

  it("falls back to the status code when the error body is unreadable", async () => {
    const html = new Response("<html>Bad gateway</html>", {
      status: 504,
      headers: { "retry-after": "12" },
    });
    expect(await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(html) })).toMatchObject({
      ok: false,
      error: { code: "TIMEOUT", retryAfterSec: 12 },
    });
    const unknown = new Response("nope", { status: 500 });
    expect(
      await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(unknown) }),
    ).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } });
  });

  it("reports network failures as NETWORK", async () => {
    const result = await requestChunk(
      { title: "x" },
      { fetchImpl: fetchReturning(new TypeError("Failed to fetch")) },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "NETWORK" } });
  });

  it("rejects when the request is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    await expect(
      requestChunk({ title: "x" }, { signal: controller.signal, fetchImpl: fetchReturning(abort) }),
    ).rejects.toBe(abort);
  });

  it("reports the guest's free tries left from the response header", async () => {
    const ok = Response.json(
      { subtasks: SUBTASKS, provider: "gemini" },
      { headers: { [FREE_TRIES_HEADER]: "2" } },
    );
    expect(await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(ok) })).toMatchObject({
      ok: true,
      freeTriesLeft: 2,
    });

    const login = Response.json(makeApiError("LOGIN_REQUIRED", "Log in."), {
      status: 401,
      headers: { [FREE_TRIES_HEADER]: "0" },
    });
    expect(await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(login) })).toEqual({
      ok: false,
      error: { code: "LOGIN_REQUIRED", message: "Log in." },
      freeTriesLeft: 0,
    });

    const junk = Response.json(
      { subtasks: SUBTASKS, provider: "gemini" },
      { headers: { [FREE_TRIES_HEADER]: "lots" } },
    );
    const result = await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(junk) });
    expect(result).not.toHaveProperty("freeTriesLeft");
  });
});

describe("requestChunk chunks left", () => {
  it("reports a logged-in user's chunks left today from the response header", async () => {
    const limited = Response.json(makeApiError("RATE_LIMITED", "Too many.", 40), {
      status: 429,
      headers: { [CHUNKS_LEFT_HEADER]: "0", "retry-after": "40" },
    });
    expect(await requestChunk({ title: "x" }, { fetchImpl: fetchReturning(limited) })).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many.", retryAfterSec: 40 },
      chunksLeftToday: 0,
    });
  });
});

describe("requestQuota", () => {
  const unknown = { freeTriesLeft: null, chunksLeftToday: null };

  it("returns the counts, or nulls when no limit applies or it can't be read", async () => {
    const fetchImpl = fetchReturning(Response.json({ freeTriesLeft: 1 }));
    expect(await requestQuota(fetchImpl)).toEqual({ freeTriesLeft: 1, chunksLeftToday: null });
    expect(fetchImpl.mock.calls[0][0]).toBe(QUOTA_ENDPOINT);

    expect(
      await requestQuota(
        fetchReturning(Response.json({ freeTriesLeft: null, chunksLeftToday: 7 })),
      ),
    ).toEqual({ freeTriesLeft: null, chunksLeftToday: 7 });
    expect(await requestQuota(fetchReturning(new Response("x", { status: 500 })))).toEqual(unknown);
    expect(await requestQuota(fetchReturning(new TypeError("offline")))).toEqual(unknown);
  });
});
