import { describe, expect, it } from "vitest";
import { createEmptyState } from "@/lib/domain/board-ops";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { createBoardStore } from "@/store/board-store";
import { createDemoState } from "./demo-seed";
import { createWorkspaceState, isUntouchedWorkspace } from "./workspace-seed";

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

describe("isUntouchedWorkspace", () => {
  const fresh = () => createBoardStore(createWorkspaceState(new Date(2026, 9, 25)));

  it("is true for the starter workspace, whatever its ids and dates", () => {
    expect(isUntouchedWorkspace(createWorkspaceState(new Date(2026, 0, 1)))).toBe(true);
    expect(isUntouchedWorkspace(fresh().getState().data)).toBe(true);
  });

  it("is false once anything was changed", () => {
    const moved = fresh();
    const data = moved.getState().data;
    const board = data.boards[data.boardOrder[0]];
    const cardId = data.columns[board.columnIds[0]].cardIds[0];
    moved.getState().actions.moveCard(cardId, board.columnIds[1], null);
    expect(isUntouchedWorkspace(moved.getState().data)).toBe(false);

    const renamed = fresh();
    renamed.getState().actions.renameBoard(renamed.getState().data.boardOrder[0], "Groceries");
    expect(isUntouchedWorkspace(renamed.getState().data)).toBe(false);

    const second = fresh();
    second.getState().actions.createBoard("Thesis");
    expect(isUntouchedWorkspace(second.getState().data)).toBe(false);
  });

  it("is false for other data and for no boards at all", () => {
    expect(isUntouchedWorkspace(createDemoState(new Date(2026, 9, 25)))).toBe(false);
    expect(isUntouchedWorkspace(createEmptyState())).toBe(false);
  });
});
