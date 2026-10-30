// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createGroqProvider } from "./groq";
import { ProviderError } from "./provider";
import { fakeFetch, groqError, groqSuccess, VALID_OUTPUT } from "./test-helpers";

const prompt = { system: "system text", user: "user text" };
const signal = () => new AbortController().signal;
const provider = (fetchImpl: typeof fetch) =>
  createGroqProvider({ apiKey: "groq-secret", model: "llama-3.3-70b-versatile", fetchImpl });

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

describe("Groq provider", () => {
  it("sends an OpenAI-style chat request in JSON mode", async () => {
    const fetch = fakeFetch(groqSuccess(VALID_OUTPUT));
    await expect(provider(fetch).generate(prompt, signal())).resolves.toBe(VALID_OUTPUT);

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer groq-secret");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "system text" },
        { role: "user", content: "user text" },
      ],
      response_format: { type: "json_object" },
    });
  });

  it("returns an empty string when there is no content", async () => {
    const empty = Response.json({ choices: [{ message: { content: null } }] });
    await expect(provider(fakeFetch(empty)).generate(prompt, signal())).resolves.toBe("");
  });

  it("maps a per-minute 429 to rate_limited with Retry-After", async () => {
    const fetch = fakeFetch(
      groqError(429, {
        message: "Rate limit reached for model on requests per minute (RPM)",
        retryAfter: "7",
      }),
    );
    expect(await failure(provider(fetch).generate(prompt, signal()))).toMatchObject({
      provider: "groq",
      kind: "rate_limited",
      retryAfterSec: 7,
    });
  });

  it.each([
    "Rate limit reached for model on tokens per day (TPD): Limit 100000",
    "Rate limit reached on requests per day (RPD)",
  ])("maps a daily 429 to quota_exhausted: %s", async (message) => {
    const fetch = fakeFetch(groqError(429, { message }));
    expect((await failure(provider(fetch).generate(prompt, signal()))).kind).toBe(
      "quota_exhausted",
    );
  });

  it.each([
    [498, "unavailable"],
    [503, "unavailable"],
    [401, "rejected"],
    [413, "rejected"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const error = await failure(provider(fakeFetch(groqError(status))).generate(prompt, signal()));
    expect(error.kind).toBe(kind);
  });

  it("maps network errors to unavailable", async () => {
    const fetch = fakeFetch(new TypeError("fetch failed"));
    expect((await failure(provider(fetch).generate(prompt, signal()))).kind).toBe("unavailable");
  });
});
