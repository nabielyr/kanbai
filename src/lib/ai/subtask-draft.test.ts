import { describe, expect, it } from "vitest";
import {
  addDraftItem,
  draftFromSubtasks,
  formatMinutes,
  getDraftTotalMinutes,
  MAX_DRAFT_ITEMS,
  moveDraftItem,
  removeDraftItem,
  updateDraftItem,
  type DraftSubtask,
} from "./subtask-draft";

const draft = (...titles: string[]): DraftSubtask[] =>
  titles.map((title, i) => ({ id: `d${i + 1}`, title, estimateMinutes: 15 }));
const titles = (items: DraftSubtask[]) => items.map((i) => i.title);

describe("draftFromSubtasks", () => {
  it("orders by `order` and gives every item a fresh id", () => {
    let n = 0;
    const items = draftFromSubtasks(
      [
        { title: "Second", estimateMinutes: 20, order: 2 },
        { title: "First", estimateMinutes: 10, order: 1 },
      ],
      () => `id-${++n}`,
    );
    expect(items).toEqual([
      { id: "id-1", title: "First", estimateMinutes: 10 },
      { id: "id-2", title: "Second", estimateMinutes: 20 },
    ]);
  });
});

describe("updateDraftItem", () => {
  it("edits the title and clamps the estimate", () => {
    const items = draft("a", "b");
    const next = updateDraftItem(items, "d1", { title: "  Write   tests ", estimateMinutes: 1000 });
    expect(next[0]).toEqual({ id: "d1", title: "Write tests", estimateMinutes: 480 });
    expect(next[1]).toBe(items[1]);
    expect(updateDraftItem(items, "d2", { estimateMinutes: 22 })[1].estimateMinutes).toBe(20);
  });

  it("rejects blank titles, invalid estimates, no-ops and unknown ids", () => {
    const items = draft("a");
    expect(updateDraftItem(items, "d1", { title: "   " })).toBe(items);
    expect(updateDraftItem(items, "d1", { estimateMinutes: Number.NaN })).toBe(items);
    expect(updateDraftItem(items, "d1", { title: "a", estimateMinutes: 15 })).toBe(items);
    expect(updateDraftItem(items, "nope", { title: "b" })).toBe(items);
  });
});

describe("removeDraftItem / addDraftItem", () => {
  it("removes an item and ignores unknown ids", () => {
    const items = draft("a", "b");
    expect(titles(removeDraftItem(items, "d1"))).toEqual(["b"]);
    expect(removeDraftItem(items, "nope")).toBe(items);
  });

  it("adds a cleaned item with a default estimate", () => {
    expect(addDraftItem(draft("a"), { id: "new", title: " - Deploy " }).at(-1)).toEqual({
      id: "new",
      title: "Deploy",
      estimateMinutes: 15,
    });
  });

  it("rejects blank titles, duplicate ids and a full draft", () => {
    const items = draft("a");
    expect(addDraftItem(items, { id: "new", title: "  " })).toBe(items);
    expect(addDraftItem(items, { id: "d1", title: "b" })).toBe(items);
    const full = draft(...Array.from({ length: MAX_DRAFT_ITEMS }, (_, i) => `t${i}`));
    expect(addDraftItem(full, { id: "new", title: "one more" })).toBe(full);
  });
});

describe("moveDraftItem", () => {
  it.each([
    ["d1", 2, ["a", "b", "c"].slice(1).concat("a")],
    ["d3", 0, ["c", "a", "b"]],
    ["d2", 99, ["a", "c", "b"]],
  ] as const)("moves %s to %i", (id, to, expected) => {
    expect(titles(moveDraftItem(draft("a", "b", "c"), id, to))).toEqual(expected);
  });

  it("returns the same array for a no-op or unknown id", () => {
    const items = draft("a", "b");
    expect(moveDraftItem(items, "d1", 0)).toBe(items);
    expect(moveDraftItem(items, "nope", 1)).toBe(items);
  });
});

describe("totals", () => {
  it("adds up estimates and formats them", () => {
    expect(getDraftTotalMinutes(draft("a", "b", "c"))).toBe(45);
    expect(getDraftTotalMinutes([])).toBe(0);
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(135)).toBe("2 h 15 min");
  });
});
