import { describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/storage/demo-seed";
import { moveCard } from "./board-ops";
import { findColumn, getDropTarget, moveToColumn, reorderInColumn, type ColumnItems } from "./drag";

const items: ColumnItems = {
  todo: ["a", "b", "c"],
  doing: ["d", "e"],
  done: [],
};

describe("findColumn", () => {
  it("finds columns by their own id or by a card id", () => {
    expect(findColumn(items, "doing")).toBe("doing");
    expect(findColumn(items, "e")).toBe("doing");
    expect(findColumn(items, "zzz")).toBeUndefined();
  });
});

describe("moveToColumn", () => {
  it("inserts before the hovered card in another column", () => {
    expect(moveToColumn(items, "a", "e")).toEqual({
      todo: ["b", "c"],
      doing: ["d", "a", "e"],
      done: [],
    });
  });

  it("inserts after the hovered card when the pointer is below its middle", () => {
    expect(moveToColumn(items, "a", "e", true).doing).toEqual(["d", "e", "a"]);
  });

  it("appends when hovering the column itself (e.g. an empty column)", () => {
    expect(moveToColumn(items, "b", "done")).toEqual({
      todo: ["a", "c"],
      doing: ["d", "e"],
      done: ["b"],
    });
  });

  it("does nothing within the same column or for unknown ids", () => {
    expect(moveToColumn(items, "a", "c")).toBe(items);
    expect(moveToColumn(items, "zzz", "doing")).toBe(items);
  });
});

describe("reorderInColumn", () => {
  it("moves a card down onto a later card's position", () => {
    expect(reorderInColumn(items, "a", "c").todo).toEqual(["b", "c", "a"]);
  });

  it("moves a card up onto an earlier card's position", () => {
    expect(reorderInColumn(items, "c", "a").todo).toEqual(["c", "a", "b"]);
  });

  it("ignores cross-column, column-level and self targets", () => {
    expect(reorderInColumn(items, "a", "d")).toBe(items);
    expect(reorderInColumn(items, "a", "todo")).toBe(items);
    expect(reorderInColumn(items, "a", "a")).toBe(items);
  });
});

describe("getDropTarget", () => {
  it("returns the column and the next card", () => {
    expect(getDropTarget(items, "b")).toEqual({ columnId: "todo", beforeCardId: "c" });
  });

  it("returns null as the neighbour for the last card", () => {
    expect(getDropTarget(items, "e")).toEqual({ columnId: "doing", beforeCardId: null });
  });

  it("returns null for unknown cards", () => {
    expect(getDropTarget(items, "zzz")).toBeNull();
  });
});

describe("full drag flow against the real state", () => {
  it("drag preview + drop produces the same order in the store", () => {
    const state = createDemoState(new Date(2026, 9, 24));
    const preview: ColumnItems = Object.fromEntries(
      Object.values(state.columns).map((c) => [c.id, c.cardIds]),
    );

    // Drag "contact-bug" over "ci" in In Progress, then up over "hero".
    let next = moveToColumn(preview, "demo-card-contact-bug", "demo-card-ci");
    next = reorderInColumn(next, "demo-card-contact-bug", "demo-card-hero");
    const target = getDropTarget(next, "demo-card-contact-bug")!;
    const moved = moveCard(state, {
      cardId: "demo-card-contact-bug",
      toColumnId: target.columnId,
      beforeCardId: target.beforeCardId,
      now: "t",
    });

    expect(moved.columns["demo-col-doing"].cardIds).toEqual(next["demo-col-doing"]);
    expect(moved.columns["demo-col-todo"].cardIds).toEqual(next["demo-col-todo"]);
  });
});
