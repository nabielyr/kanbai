import { describe, expect, it } from "vitest";
import {
  AI_ERROR_CODES,
  AI_ERROR_STATUS,
  apiErrorSchema,
  chunkRequestSchema,
  chunkResponseSchema,
  DETAIL_LEVELS,
  DETAIL_TARGETS,
  makeApiError,
  MAX_SUBTASKS,
  MIN_SUBTASKS,
} from "./schemas";

const subtask = (order: number) => ({ title: `Step number ${order}`, estimateMinutes: 15, order });

describe("chunkRequestSchema", () => {
  it("trims input and fills defaults", () => {
    expect(chunkRequestSchema.parse({ title: "  Launch the site  " })).toEqual({
      title: "Launch the site",
      description: "",
      detail: "medium",
    });
  });

  it.each([
    [{ title: "   " }],
    [{ title: "x".repeat(201) }],
    [{ title: "ok", description: "x".repeat(2001) }],
    [{ title: "ok", detail: "huge" }],
    [{ description: "no title" }],
    ["not an object"],
  ])("rejects %j", (input) => {
    expect(chunkRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe("chunkResponseSchema", () => {
  it("accepts 3 to 8 subtasks", () => {
    for (const count of [MIN_SUBTASKS, MAX_SUBTASKS]) {
      const subtasks = Array.from({ length: count }, (_, i) => subtask(i + 1));
      expect(chunkResponseSchema.safeParse({ subtasks, provider: "gemini" }).success).toBe(true);
    }
  });

  it.each([
    [{ subtasks: [subtask(1), subtask(2)], provider: "gemini" }],
    [{ subtasks: Array.from({ length: 9 }, (_, i) => subtask(i + 1)), provider: "groq" }],
    [
      {
        subtasks: [subtask(1), subtask(2), { ...subtask(3), estimateMinutes: 2 }],
        provider: "groq",
      },
    ],
    [{ subtasks: [subtask(1), subtask(2), { ...subtask(3), title: "ab" }], provider: "groq" }],
    [{ subtasks: [subtask(1), subtask(2), subtask(3)], provider: "openai" }],
  ])("rejects %j", (input) => {
    expect(chunkResponseSchema.safeParse(input).success).toBe(false);
  });
});

describe("detail targets", () => {
  it("stay within the allowed subtask range and grow with detail", () => {
    let previousMax = 0;
    for (const level of DETAIL_LEVELS) {
      const { min, max } = DETAIL_TARGETS[level];
      expect(min).toBeGreaterThanOrEqual(MIN_SUBTASKS);
      expect(max).toBeLessThanOrEqual(MAX_SUBTASKS);
      expect(min).toBeLessThanOrEqual(max);
      expect(max).toBeGreaterThan(previousMax);
      previousMax = max;
    }
  });
});

describe("API errors", () => {
  it("builds errors that match the schema", () => {
    expect(apiErrorSchema.parse(makeApiError("RATE_LIMITED", "Slow down", 30))).toEqual({
      error: { code: "RATE_LIMITED", message: "Slow down", retryAfterSec: 30 },
    });
    expect(makeApiError("TIMEOUT", "Too slow")).toEqual({
      error: { code: "TIMEOUT", message: "Too slow" },
    });
  });

  it("maps every code to an HTTP error status", () => {
    for (const code of AI_ERROR_CODES) {
      expect(AI_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(AI_ERROR_STATUS[code]).toBeLessThan(600);
    }
    expect(AI_ERROR_STATUS.LOGIN_REQUIRED).toBe(401);
    expect(AI_ERROR_STATUS.INVALID_AI_RESPONSE).toBe(502);
  });

  it("rejects unknown codes", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "OOPS", message: "x" } }).success).toBe(false);
  });
});
