// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeFetch,
  geminiError,
  geminiSuccess,
  groqError,
  groqSuccess,
  VALID_OUTPUT,
} from "@/server/ai/test-helpers";
import { POST } from "./route";

// The whole route with the real providers, but a fake network: what a visitor sees when the
// AI misbehaves. Both providers are configured, so every case goes through the fallback.

const APP = "http://localhost:3000";
const DAILY = { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" };

function post(signal?: AbortSignal): Promise<Response> {
  return POST(
    new Request(`${APP}/api/ai/chunk`, {
      method: "POST",
      headers: { origin: APP, host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ title: "Write a blog post" }),
      signal,
    }),
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "gemini-key");
  vi.stubEnv("GROQ_API_KEY", "groq-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/ai/chunk when the AI misbehaves", () => {
  it("answers 502 INVALID_AI_RESPONSE when both providers keep returning junk", async () => {
    // Each provider gets its first try and one retry.
    const junk = () => geminiSuccess("Sure! Here are some ideas.");
    const groqJunk = () => groqSuccess("I can't do that.");
    vi.stubGlobal("fetch", fakeFetch(junk(), junk(), groqJunk(), groqJunk()));

    const response = await post();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("INVALID_AI_RESPONSE");
  });

  it("answers 503 QUOTA_EXHAUSTED when the daily quota is gone everywhere", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch(
        geminiError(429, DAILY),
        groqError(429, { message: "Rate limit reached for requests per day (RPD)" }),
      ),
    );
    const response = await post();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("QUOTA_EXHAUSTED");
  });

  it("falls back to Groq when Gemini is down", async () => {
    vi.stubGlobal("fetch", fakeFetch(geminiError(503), groqSuccess(VALID_OUTPUT)));
    const response = await post();
    expect(response.status).toBe(200);
    expect((await response.json()).provider).toBe("groq");
  });

  it("answers 499 without trying Groq when the visitor cancels", async () => {
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetch);

    const response = await post(controller.signal);
    expect(response.status).toBe(499);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
