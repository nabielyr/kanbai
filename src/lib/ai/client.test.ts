// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CHUNK_ENDPOINT, requestChunk } from "./client";
import { makeApiError } from "./schemas";

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
});
