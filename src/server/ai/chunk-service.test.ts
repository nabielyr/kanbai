// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chunkRequestSchema } from "@/lib/ai/schemas";
import { getServerEnv } from "@/server/env";
import { chunkTask, createProviders } from "./chunk-service";
import { ProviderError, type LlmProvider } from "./provider";
import { VALID_OUTPUT } from "./test-helpers";

const request = chunkRequestSchema.parse({ title: "Write a blog post" });
const signal = () => new AbortController().signal;

function fakeProvider(name: LlmProvider["name"], ...outputs: (string | Error)[]) {
  const generate = vi.fn<LlmProvider["generate"]>(async () => {
    const next = outputs.shift();
    if (next === undefined) throw new Error("unexpected extra call");
    if (next instanceof Error) throw next;
    return next;
  });
  return { name, generate } satisfies LlmProvider;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("createProviders", () => {
  it("only includes providers that have a key", () => {
    expect(createProviders(getServerEnv({}))).toEqual([]);
    expect(createProviders(getServerEnv({ GEMINI_API_KEY: "k" })).map((p) => p.name)).toEqual([
      "gemini",
    ]);
  });
});

describe("getServerEnv", () => {
  it("uses default models and ignores empty values", () => {
    expect(getServerEnv({ GEMINI_API_KEY: "  ", GEMINI_MODEL: "" })).toEqual({
      GEMINI_API_KEY: undefined,
      GEMINI_MODEL: "gemini-2.5-flash",
      GROQ_API_KEY: undefined,
      GROQ_MODEL: "llama-3.3-70b-versatile",
    });
  });
});

describe("chunkTask", () => {
  it("returns normalized subtasks with the provider name", async () => {
    const gemini = fakeProvider("gemini", VALID_OUTPUT);
    const result = await chunkTask(request, { providers: [gemini], signal: signal() });

    expect(result).toEqual({
      ok: true,
      response: {
        provider: "gemini",
        subtasks: [
          { title: "Outline the sections", estimateMinutes: 20, order: 1 },
          { title: "Write the first draft", estimateMinutes: 60, order: 2 },
          { title: "Proofread and publish", estimateMinutes: 25, order: 3 },
        ],
      },
    });
    expect(gemini.generate.mock.calls[0][0].user).toContain("<title>Write a blog post</title>");
  });

  it("is unavailable when no provider is configured", async () => {
    const result = await chunkTask(request, { providers: [], signal: signal() });
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      body: { error: { code: "UNAVAILABLE" } },
    });
  });

  it("reports unusable output as INVALID_AI_RESPONSE", async () => {
    const result = await chunkTask(request, {
      providers: [fakeProvider("gemini", "I can't do that", "still not JSON")],
      signal: signal(),
    });
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      body: { error: { code: "INVALID_AI_RESPONSE" } },
    });
  });

  it.each([
    ["rate_limited", 429, "RATE_LIMITED"],
    ["quota_exhausted", 503, "QUOTA_EXHAUSTED"],
    ["timeout", 504, "TIMEOUT"],
    ["unavailable", 503, "UNAVAILABLE"],
    ["rejected", 503, "UNAVAILABLE"],
  ] as const)("maps a %s failure to %i %s", async (kind, status, code) => {
    const error = new ProviderError("gemini", kind, "boom", 30);
    const result = await chunkTask(request, {
      providers: [fakeProvider("gemini", error, error)],
      signal: signal(),
    });
    expect(result).toMatchObject({ ok: false, status, body: { error: { code } } });
  });

  it("passes the retry delay through for rate limits", async () => {
    const error = new ProviderError("gemini", "rate_limited", "slow down", 30);
    const result = await chunkTask(request, {
      providers: [fakeProvider("gemini", error)],
      signal: signal(),
    });
    expect(result).toMatchObject({ body: { error: { retryAfterSec: 30 } } });
  });

  it("re-throws errors that are not provider failures (e.g. a cancellation)", async () => {
    const abort = new DOMException("aborted", "AbortError");
    await expect(
      chunkTask(request, { providers: [fakeProvider("gemini", abort)], signal: signal() }),
    ).rejects.toBe(abort);
  });
});
