// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFetch, geminiError, geminiSuccess, VALID_OUTPUT } from "@/server/ai/test-helpers";
import { POST } from "./route";

const APP = "http://localhost:3000";

function chunkRequest(body: unknown, headers: Record<string, string> = { origin: APP }): Request {
  return new Request(`${APP}/api/ai/chunk`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GROQ_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/ai/chunk", () => {
  it("returns subtasks from Gemini", async () => {
    const fetch = fakeFetch(geminiSuccess(VALID_OUTPUT));
    vi.stubGlobal("fetch", fetch);

    const response = await POST(chunkRequest({ title: "Write a blog post", detail: "brief" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.provider).toBe("gemini");
    expect(body.subtasks).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no Origin header", {}],
    ["another site", { origin: "https://evil.example" }],
    ["a malformed Origin", { origin: "not a url" }],
  ])("rejects %s with 403", async (_, headers) => {
    const fetch = fakeFetch();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(chunkRequest({ title: "x" }, headers));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts the forwarded host behind a proxy", async () => {
    vi.stubGlobal("fetch", fakeFetch(geminiSuccess(VALID_OUTPUT)));
    const response = await POST(
      chunkRequest(
        { title: "x" },
        { origin: "https://kanbai.vercel.app", "x-forwarded-host": "kanbai.vercel.app" },
      ),
    );
    expect(response.status).toBe(200);
  });

  it("rejects bodies over 8 KB", async () => {
    const response = await POST(chunkRequest({ title: "x", description: "y".repeat(9000) }));
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("VALIDATION");
  });

  it.each([
    ["invalid JSON", "{not json", "The request body must be JSON."],
    ["a missing title", { description: "no title" }, "Invalid title."],
    ["an unknown detail level", { title: "x", detail: "huge" }, "Invalid detail."],
  ])("rejects %s with 400", async (_, body, message) => {
    const response = await POST(chunkRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "VALIDATION", message } });
  });

  it("answers 503 when no AI key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await POST(chunkRequest({ title: "x" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("UNAVAILABLE");
  });

  it("forwards rate limits with a Retry-After header", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch(geminiError(429, { retryDelay: "20s" }), geminiError(429, { retryDelay: "20s" })),
    );
    const response = await POST(chunkRequest({ title: "x" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("20");
  });

  it("never leaks the API key in a response", async () => {
    vi.stubGlobal("fetch", fakeFetch(geminiError(400, { message: "API key not valid" })));
    const response = await POST(chunkRequest({ title: "x" }));
    expect(await response.text()).not.toContain("test-key");
  });
});
