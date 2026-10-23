import { describe, expect, it } from "vitest";
import { getChecklistProgress } from "./checklist";
import type { ChecklistItem } from "./types";

const item = (done: boolean, i: number): ChecklistItem => ({
  id: `i${i}`,
  title: `Item ${i}`,
  done,
  source: "manual",
});

describe("getChecklistProgress", () => {
  it("is zero for an empty checklist", () => {
    expect(getChecklistProgress([])).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it("counts done items", () => {
    const items = [true, true, true, false, false].map(item);
    expect(getChecklistProgress(items)).toEqual({ done: 3, total: 5, ratio: 0.6 });
  });

  it("is 1 when everything is done", () => {
    expect(getChecklistProgress([true, true].map(item)).ratio).toBe(1);
  });
});
