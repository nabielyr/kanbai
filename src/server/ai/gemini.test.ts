// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createGeminiProvider, GEMINI_RESPONSE_SCHEMA } from "./gemini";
import { ProviderError } from "./provider";
import { fakeFetch, geminiError, geminiSuccess, VALID_OUTPUT } from "./test-helpers";

const prompt = { system: "system text", user: "user text" };
const signal = () => new AbortController().signal;

function provider(fetchImpl: typeof fetch, model = "gemini-2.5-flash") {
  return createGeminiProvider({ apiKey: "secret-key", model, fetchImpl });
}

async function failure(promise: Promise<unknown>): Promise<ProviderError> {
  const error = await promise.then(
    () => {
      throw new Error("expected a failure");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

describe("Gemini provider", () => {
  it("sends the prompt with structured output, keeping the key out of the URL", async () => {
    const fetch = fakeFetch(geminiSuccess(VALID_OUTPUT));
    await provider(fetch).generate(prompt, signal());

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(String(url)).not.toContain("secret-key");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("secret-key");

    const body = JSON.parse(String(init?.body));
    expect(body.systemInstruction.parts[0].text).toBe("system text");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "user text" }] }]);
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });

  it("only turns thinking off for 2.5 Flash models", async () => {
    const fetch = fakeFetch(geminiSuccess(VALID_OUTPUT));
    await provider(fetch, "gemini-2.0-flash").generate(prompt, signal());
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("returns the text of the first candidate", async () => {
    const response = Response.json({
      candidates: [{ content: { parts: [{ text: '{"subtasks":' }, { text: "[]}" }] } }],
    });
    await expect(provider(fakeFetch(response)).generate(prompt, signal())).resolves.toBe(
      '{"subtasks":[]}',
    );
  });

  it("returns an empty string when there is no candidate", async () => {
    await expect(
      provider(fakeFetch(Response.json({ candidates: [] }))).generate(prompt, signal()),
    ).resolves.toBe("");
  });

  it("maps a per-minute 429 to rate_limited with the retry delay", async () => {
    const fetch = fakeFetch(
      geminiError(429, { retryDelay: "31.5s", quotaId: "GenerateRequestsPerMinutePerProject" }),
    );
    const error = await failure(provider(fetch).generate(prompt, signal()));
    expect(error).toMatchObject({ provider: "gemini", kind: "rate_limited", retryAfterSec: 32 });
  });

  it("maps a per-day 429 to quota_exhausted", async () => {
    const fetch = fakeFetch(
      geminiError(429, { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }),
    );
    expect((await failure(provider(fetch).generate(prompt, signal()))).kind).toBe(
      "quota_exhausted",
    );
  });

  it.each([
    [503, "unavailable"],
    [500, "unavailable"],
    [408, "timeout"],
    [400, "rejected"],
    [403, "rejected"],
    [404, "rejected"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const error = await failure(
      provider(fakeFetch(geminiError(status))).generate(prompt, signal()),
    );
    expect(error.kind).toBe(kind);
  });

  it("treats a blocked prompt as rejected", async () => {
    const blocked = Response.json({ promptFeedback: { blockReason: "SAFETY" } });
    const error = await failure(provider(fakeFetch(blocked)).generate(prompt, signal()));
    expect(error).toMatchObject({ kind: "rejected" });
    expect(error.message).toContain("SAFETY");
  });

  it("maps network errors to unavailable", async () => {
    const fetch = fakeFetch(new TypeError("fetch failed"));
    expect((await failure(provider(fetch).generate(prompt, signal()))).kind).toBe("unavailable");
  });

  it("maps our own timeout to timeout", async () => {
    const timedOut = AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
    const fetch = fakeFetch(new DOMException("aborted", "AbortError"));
    expect((await failure(provider(fetch).generate(prompt, timedOut))).kind).toBe("timeout");
  });

  it("re-throws a cancellation untouched", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("aborted", "AbortError");
    await expect(provider(fakeFetch(abort)).generate(prompt, controller.signal)).rejects.toBe(
      abort,
    );
  });
});
