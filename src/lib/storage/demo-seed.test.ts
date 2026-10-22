import { describe, expect, it } from "vitest";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { createDemoState, DEMO_BOARD_ID } from "./demo-seed";

const NOW = new Date(2026, 9, 22, 10, 30); // 22 Oct 2026, local time

describe("createDemoState", () => {
  const state = createDemoState(NOW);
  const board = state.boards[DEMO_BOARD_ID];
  const columns = board.columnIds.map((id) => state.columns[id]);
  const cards = Object.values(state.cards);

  it("produces a consistent normalized state", () => {
    expect(findIntegrityIssues(state)).toEqual([]);
  });

  it("has one active board with To Do / In Progress / Done columns", () => {
    expect(state.boardOrder).toEqual([DEMO_BOARD_ID]);
    expect(state.activeBoardId).toBe(DEMO_BOARD_ID);
    expect(columns.map((c) => c.title)).toEqual(["To Do", "In Progress", "Done"]);
    expect(columns.filter((c) => c.isDone).map((c) => c.title)).toEqual(["Done"]);
  });

  it("has about 8 cards with labels on every card", () => {
    expect(cards).toHaveLength(8);
    expect(cards.every((c) => c.labelIds.length > 0)).toBe(true);
  });

  it("puts due dates relative to now so every indicator shows", () => {
    const todo = state.columns["demo-col-todo"].cardIds.map((id) => state.cards[id]);
    const dueDates = todo.map((c) => c.dueDate);
    expect(dueDates).toContain("2026-10-21"); // overdue (yesterday)
    expect(dueDates).toContain("2026-10-24"); // due soon (+2)
    expect(state.cards["demo-card-hero"].dueDate).toBe("2026-10-22"); // today
  });

  it("includes a big card with no checklist to invite Chunk it", () => {
    const big = state.cards["demo-card-portfolio"];
    expect(big.checklist).toEqual([]);
    expect(big.description).toMatch(/Chunk it/);
  });

  it("includes partly done checklists", () => {
    const hero = state.cards["demo-card-hero"].checklist;
    expect(hero.filter((i) => i.done)).toHaveLength(3);
    expect(hero).toHaveLength(5);
  });

  it("is deterministic for the same date (so Reset demo is stable)", () => {
    expect(createDemoState(NOW)).toEqual(state);
  });
});
