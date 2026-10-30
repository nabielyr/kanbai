// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chunkRequestSchema } from "@/lib/ai/schemas";
import { getServerEnv } from "@/server/env";
import { chunkTask, createProviders, summarizeFailures } from "./chunk-service";
import { ProviderError, type LlmProvider } from "./provider";
import { JSON_REMINDER } from "./prompts";
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

describe("createProviders order", () => {
  it("tries Gemini first, then Groq", () => {
    const env = getServerEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" });
    expect(createProviders(env).map((p) => p.name)).toEqual(["gemini", "groq"]);
    expect(createProviders(getServerEnv({ GROQ_API_KEY: "q" })).map((p) => p.name)).toEqual([
      "groq",
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

describe("chunkTask retry and fallback", () => {
  const rateLimited = (retryAfterSec?: number) =>
    new ProviderError("gemini", "rate_limited", "slow down", retryAfterSec);

  it("retries once with a JSON reminder when the output is unusable", async () => {
    const gemini = fakeProvider("gemini", "Sure! Here are some ideas...", VALID_OUTPUT);
    const result = await chunkTask(request, { providers: [gemini], signal: signal() });

    expect(result).toMatchObject({ ok: true, response: { provider: "gemini" } });
    expect(gemini.generate).toHaveBeenCalledTimes(2);
    expect(gemini.generate.mock.calls[0][0].user).not.toContain(JSON_REMINDER);
    expect(gemini.generate.mock.calls[1][0].user).toContain(JSON_REMINDER);
  });

  it("does not retry the same provider after a provider error", async () => {
    const gemini = fakeProvider("gemini", rateLimited(10), VALID_OUTPUT);
    await chunkTask(request, { providers: [gemini], signal: signal() });
    expect(gemini.generate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["is rate limited", rateLimited(10)],
    ["has a bad key", new ProviderError("gemini", "rejected", "403 API key not valid")],
    ["is down", new ProviderError("gemini", "unavailable", "503")],
    ["times out", new ProviderError("gemini", "timeout", "timed out")],
  ])("falls back to Groq when Gemini %s", async (_, error) => {
    const gemini = fakeProvider("gemini", error);
    const groq = fakeProvider("groq", VALID_OUTPUT);
    const result = await chunkTask(request, { providers: [gemini, groq], signal: signal() });
    expect(result).toMatchObject({ ok: true, response: { provider: "groq" } });
  });

  it("falls back to Groq when the output stays unusable after the retry", async () => {
    const gemini = fakeProvider("gemini", "nope", "still nope");
    const groq = fakeProvider("groq", VALID_OUTPUT);
    const result = await chunkTask(request, { providers: [gemini, groq], signal: signal() });
    expect(result).toMatchObject({ ok: true, response: { provider: "groq" } });
    expect(gemini.generate).toHaveBeenCalledTimes(2);
  });

  it("gives each provider its own time budget", async () => {
    // Never answers until its signal is aborted, like a hung request.
    const hanging: LlmProvider = {
      name: "gemini",
      generate: (_, providerSignal) =>
        new Promise((_, reject) =>
          providerSignal.addEventListener("abort", () =>
            reject(new ProviderError("gemini", "timeout", "timed out")),
          ),
        ),
    };
    const groq = fakeProvider("groq", VALID_OUTPUT);
    const result = await chunkTask(request, {
      providers: [hanging, groq],
      signal: signal(),
      timeoutMs: 20,
    });
    expect(result).toMatchObject({ ok: true, response: { provider: "groq" } });
  });

  it("stops without trying Groq when the visitor cancels", async () => {
    const controller = new AbortController();
    const gemini: LlmProvider = {
      name: "gemini",
      generate: async () => {
        controller.abort();
        throw new ProviderError("gemini", "unavailable", "socket closed");
      },
    };
    const groq = fakeProvider("groq", VALID_OUTPUT);
    await expect(
      chunkTask(request, { providers: [gemini, groq], signal: controller.signal }),
    ).rejects.toThrow();
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it("summarizes when both providers fail", async () => {
    const result = await chunkTask(request, {
      providers: [
        fakeProvider("gemini", new ProviderError("gemini", "quota_exhausted", "daily")),
        fakeProvider("groq", new ProviderError("groq", "quota_exhausted", "daily")),
      ],
      signal: signal(),
    });
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      body: { error: { code: "QUOTA_EXHAUSTED" } },
    });
  });
});

describe("summarizeFailures", () => {
  const error = (...failures: Parameters<typeof summarizeFailures>[0]) => {
    const result = summarizeFailures(failures);
    return result.ok ? null : result.body.error;
  };

  it("only says the output was odd when every provider returned junk", () => {
    expect(error({ kind: "invalid" }, { kind: "invalid" })?.code).toBe("INVALID_AI_RESPONSE");
    expect(error({ kind: "invalid" }, { kind: "unavailable" })?.code).toBe("UNAVAILABLE");
  });

  it("prefers a short wait, using the smallest known delay", () => {
    expect(error({ kind: "quota_exhausted" }, { kind: "rate_limited", retryAfterSec: 40 })).toEqual(
      expect.objectContaining({ code: "RATE_LIMITED", retryAfterSec: 40 }),
    );
    expect(
      error({ kind: "rate_limited", retryAfterSec: 40 }, { kind: "rate_limited", retryAfterSec: 9 })
        ?.retryAfterSec,
    ).toBe(9);
    expect(error({ kind: "rate_limited" })).not.toHaveProperty("retryAfterSec");
  });

  it("only reports the daily quota when it ran out everywhere", () => {
    expect(error({ kind: "quota_exhausted" })?.code).toBe("QUOTA_EXHAUSTED");
    expect(error({ kind: "quota_exhausted" }, { kind: "unavailable" })?.code).toBe("UNAVAILABLE");
  });

  it("reports timeouts, then falls back to unavailable", () => {
    expect(error({ kind: "timeout" }, { kind: "unavailable" })?.code).toBe("TIMEOUT");
    expect(error({ kind: "rejected" }, { kind: "unavailable" })?.code).toBe("UNAVAILABLE");
  });
});
