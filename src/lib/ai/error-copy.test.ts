import { describe, expect, it } from "vitest";
import type { ChunkErrorCode } from "./client";
import { getChunkErrorCopy } from "./error-copy";

const copy = (code: ChunkErrorCode, retryAfterSec?: number, message = "Server says hi.") =>
  getChunkErrorCopy({ code, message, retryAfterSec });

describe("getChunkErrorCopy", () => {
  it("asks to wait when the AI is rate limited with a known delay", () => {
    expect(copy("RATE_LIMITED", 30)).toMatchObject({
      title: "The AI is busy",
      detail: "Lots of requests right now. Try again in 30s.",
      retry: "wait",
      retryAfterSec: 30,
    });
    expect(copy("RATE_LIMITED")).toMatchObject({ retry: "now" });
  });

  it("treats a long rate-limit wait as the daily limit, with no countdown", () => {
    expect(copy("RATE_LIMITED", 3 * 3600, "You've used your 30 chunks for today.")).toMatchObject({
      title: "Daily limit reached",
      detail: "You've used your 30 chunks for today.",
      retry: "none",
      offerManual: true,
    });
  });

  it("offers manual steps instead of a retry when the daily quota is used up", () => {
    expect(copy("QUOTA_EXHAUSTED")).toMatchObject({
      title: "Daily AI quota reached",
      retry: "none",
      offerManual: true,
    });
  });

  it.each([
    ["TIMEOUT", "That took too long"],
    ["INVALID_AI_RESPONSE", "The AI returned something odd"],
    ["NETWORK", "You seem to be offline"],
  ] as const)("lets %s be retried right away", (code, title) => {
    expect(copy(code)).toMatchObject({ title, retry: "now" });
  });

  it("shows the server's own explanation when the AI is unavailable or input is invalid", () => {
    expect(copy("UNAVAILABLE", undefined, "AI isn't set up on this server yet.").detail).toBe(
      "AI isn't set up on this server yet.",
    );
    expect(copy("VALIDATION", undefined, "The task is too long.")).toMatchObject({
      detail: "The task is too long.",
      retry: "none",
    });
  });

  it("covers every error code with a title and a detail", () => {
    const codes: ChunkErrorCode[] = [
      "VALIDATION",
      "LOGIN_REQUIRED",
      "RATE_LIMITED",
      "QUOTA_EXHAUSTED",
      "TIMEOUT",
      "INVALID_AI_RESPONSE",
      "UNAVAILABLE",
      "NETWORK",
    ];
    for (const code of codes) {
      const result = copy(code, 10);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });
});
