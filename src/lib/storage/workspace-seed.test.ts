import { describe, expect, it } from "vitest";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { createWorkspaceState } from "./workspace-seed";

describe("createWorkspaceState", () => {
  it("creates one active board with default columns and a welcome card", () => {
    let n = 0;
    const state = createWorkspaceState(new Date(2026, 9, 25), () => `id${++n}`);
    const board = state.boards[state.activeBoardId!];

    expect(state.boardOrder).toHaveLength(1);
    expect(board.title).toBe("My first board");
    expect(board.columnIds.map((id) => state.columns[id].title)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
    const todo = state.columns[board.columnIds[0]];
    expect(todo.cardIds.map((id) => state.cards[id].title)).toEqual([
      "👋 Drag this card to In Progress",
    ]);
    expect(findIntegrityIssues(state)).toEqual([]);
  });

  it("uses fresh ids every time by default", () => {
    expect(createWorkspaceState().activeBoardId).not.toBe(createWorkspaceState().activeBoardId);
  });
});
