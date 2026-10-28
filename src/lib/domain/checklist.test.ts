import { describe, expect, it } from "vitest";
import {
  addChecklistItem,
  deleteChecklistItem,
  getChecklistProgress,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TITLE_LENGTH,
  moveChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from "./checklist";
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

const list = (...titles: string[]): ChecklistItem[] =>
  titles.map((title, i) => ({ id: `i${i + 1}`, title, done: false, source: "manual" }));
const titles = (items: ChecklistItem[]) => items.map((i) => i.title);

describe("addChecklistItem", () => {
  it("appends a cleaned, unchecked manual item", () => {
    const next = addChecklistItem(list("a"), { id: "new", title: "  write   tests " });
    expect(next.at(-1)).toEqual({ id: "new", title: "write tests", done: false, source: "manual" });
  });

  it("caps long titles", () => {
    const next = addChecklistItem([], { id: "new", title: "x".repeat(500) });
    expect(next[0].title).toHaveLength(MAX_CHECKLIST_TITLE_LENGTH);
  });

  it("rejects blank titles, duplicate ids and a full checklist", () => {
    const items = list("a");
    expect(addChecklistItem(items, { id: "new", title: "  " })).toBe(items);
    expect(addChecklistItem(items, { id: "i1", title: "b" })).toBe(items);
    const full = list(...Array.from({ length: MAX_CHECKLIST_ITEMS }, (_, i) => `t${i}`));
    expect(addChecklistItem(full, { id: "new", title: "one more" })).toBe(full);
  });
});

describe("toggleChecklistItem", () => {
  it("flips done for one item only", () => {
    const items = list("a", "b");
    const next = toggleChecklistItem(items, { itemId: "i2" });
    expect(next.map((i) => i.done)).toEqual([false, true]);
    expect(next[0]).toBe(items[0]);
    expect(toggleChecklistItem(next, { itemId: "i2" })[1].done).toBe(false);
  });

  it("ignores unknown items", () => {
    const items = list("a");
    expect(toggleChecklistItem(items, { itemId: "nope" })).toBe(items);
  });
});

describe("renameChecklistItem", () => {
  it("renames an item", () => {
    expect(titles(renameChecklistItem(list("a", "b"), { itemId: "i1", title: " A " }))).toEqual([
      "A",
      "b",
    ]);
  });

  it("rejects blank or unchanged titles and unknown items", () => {
    const items = list("a");
    expect(renameChecklistItem(items, { itemId: "i1", title: " " })).toBe(items);
    expect(renameChecklistItem(items, { itemId: "i1", title: "a" })).toBe(items);
    expect(renameChecklistItem(items, { itemId: "nope", title: "b" })).toBe(items);
  });
});

describe("deleteChecklistItem", () => {
  it("removes an item and ignores unknown ids", () => {
    const items = list("a", "b");
    expect(titles(deleteChecklistItem(items, { itemId: "i1" }))).toEqual(["b"]);
    expect(deleteChecklistItem(items, { itemId: "nope" })).toBe(items);
  });
});

describe("moveChecklistItem", () => {
  it.each([
    ["i1", 2, ["b", "c", "a"]],
    ["i3", 0, ["c", "a", "b"]],
    ["i2", 99, ["a", "c", "b"]],
    ["i2", -5, ["b", "a", "c"]],
  ] as const)("moves %s to %i", (itemId, toIndex, expected) => {
    expect(titles(moveChecklistItem(list("a", "b", "c"), { itemId, toIndex }))).toEqual(expected);
  });

  it("returns the same array for a no-op or unknown item", () => {
    const items = list("a", "b");
    expect(moveChecklistItem(items, { itemId: "i1", toIndex: 0 })).toBe(items);
    expect(moveChecklistItem(items, { itemId: "nope", toIndex: 1 })).toBe(items);
  });
});
