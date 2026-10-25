import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import {
  addCard,
  createBoard,
  createEmptyState,
  deleteBoard,
  renameBoard,
  setActiveBoard,
} from "./board-ops";
import { findIntegrityIssues } from "./integrity";

const NOW = "2026-10-25T10:00:00.000Z";
const columnIds = (prefix: string) => [`${prefix}-c1`, `${prefix}-c2`, `${prefix}-c3`];

describe("createEmptyState", () => {
  it("has no boards and is consistent", () => {
    const state = createEmptyState();
    expect(state.boardOrder).toEqual([]);
    expect(state.activeBoardId).toBeNull();
    expect(findIntegrityIssues(state)).toEqual([]);
  });
});

describe("createBoard", () => {
  it("creates a board with default columns and labels, and makes it active", () => {
    const state = createBoard(createEmptyState(), {
      id: "b1",
      title: "  Side project ",
      columnIds: columnIds("b1"),
      now: NOW,
    });

    expect(state.activeBoardId).toBe("b1");
    expect(state.boardOrder).toEqual(["b1"]);
    expect(state.boards.b1).toMatchObject({ title: "Side project", columnIds: columnIds("b1") });
    expect(state.boards.b1.labels.map((l) => l.name)).toEqual(["feature", "bug", "design", "idea"]);
    expect(columnIds("b1").map((id) => state.columns[id].title)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
    expect(state.columns["b1-c3"].isDone).toBe(true);
    expect(state.columns["b1-c1"]).not.toHaveProperty("isDone");
    expect(findIntegrityIssues(state)).toEqual([]);
  });

  it("gives every board its own label ids", () => {
    let state = createBoard(createEmptyState(), {
      id: "b1",
      title: "One",
      columnIds: columnIds("b1"),
      now: NOW,
    });
    state = createBoard(state, { id: "b2", title: "Two", columnIds: columnIds("b2"), now: NOW });
    const ids1 = state.boards.b1.labels.map((l) => l.id);
    const ids2 = state.boards.b2.labels.map((l) => l.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    expect(state.boardOrder).toEqual(["b1", "b2"]);
  });

  it("rejects empty titles, duplicate ids and bad column ids", () => {
    const empty = createEmptyState();
    expect(createBoard(empty, { id: "b1", title: " ", columnIds: columnIds("b1"), now: NOW })).toBe(
      empty,
    );
    expect(createBoard(empty, { id: "b1", title: "x", columnIds: ["a", "a", "b"], now: NOW })).toBe(
      empty,
    );
    expect(createBoard(empty, { id: "b1", title: "x", columnIds: ["a"], now: NOW })).toBe(empty);

    const demo = createDemoState();
    expect(
      createBoard(demo, { id: DEMO_BOARD_ID, title: "x", columnIds: columnIds("n"), now: NOW }),
    ).toBe(demo);
    expect(
      createBoard(demo, {
        id: "b1",
        title: "x",
        columnIds: ["demo-col-todo", "n2", "n3"],
        now: NOW,
      }),
    ).toBe(demo);
  });
});

describe("renameBoard", () => {
  it("renames and ignores empty titles", () => {
    const demo = createDemoState();
    const renamed = renameBoard(demo, { boardId: DEMO_BOARD_ID, title: "Portfolio", now: NOW });
    expect(renamed.boards[DEMO_BOARD_ID]).toMatchObject({ title: "Portfolio", updatedAt: NOW });
    expect(renameBoard(demo, { boardId: DEMO_BOARD_ID, title: "  ", now: NOW })).toBe(demo);
  });
});

describe("deleteBoard", () => {
  const threeBoards = () => {
    let state = createDemoState(); // demo-board
    state = createBoard(state, { id: "b1", title: "One", columnIds: columnIds("b1"), now: NOW });
    state = addCard(state, { columnId: "b1-c1", id: "card1", title: "Task", now: NOW });
    state = createBoard(state, { id: "b2", title: "Two", columnIds: columnIds("b2"), now: NOW });
    return state; // order: demo-board, b1, b2 — active b2
  };

  it("removes the board with all its columns and cards", () => {
    const state = setActiveBoard(threeBoards(), { boardId: DEMO_BOARD_ID });
    const next = deleteBoard(state, { boardId: "b1" });

    expect(next.boards.b1).toBeUndefined();
    expect(next.columns["b1-c1"]).toBeUndefined();
    expect(next.cards.card1).toBeUndefined();
    expect(next.boardOrder).toEqual([DEMO_BOARD_ID, "b2"]);
    expect(next.activeBoardId).toBe(DEMO_BOARD_ID); // unchanged
    expect(Object.keys(next.cards)).toHaveLength(8); // demo cards untouched
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("activates the next board when the active one is deleted", () => {
    const state = setActiveBoard(threeBoards(), { boardId: "b1" });
    expect(deleteBoard(state, { boardId: "b1" }).activeBoardId).toBe("b2");
  });

  it("falls back to the previous board when deleting the last in order", () => {
    expect(deleteBoard(threeBoards(), { boardId: "b2" }).activeBoardId).toBe("b1");
  });

  it("leaves no active board after deleting the only one", () => {
    const next = deleteBoard(createDemoState(), { boardId: DEMO_BOARD_ID });
    expect(next).toMatchObject({ boardOrder: [], activeBoardId: null, cards: {}, columns: {} });
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("ignores unknown boards", () => {
    const demo = createDemoState();
    expect(deleteBoard(demo, { boardId: "nope" })).toBe(demo);
  });
});

describe("setActiveBoard", () => {
  it("switches boards and ignores unknown or already-active ones", () => {
    let state = createBoard(createDemoState(), {
      id: "b1",
      title: "One",
      columnIds: columnIds("b1"),
      now: NOW,
    });
    state = setActiveBoard(state, { boardId: DEMO_BOARD_ID });
    expect(state.activeBoardId).toBe(DEMO_BOARD_ID);
    expect(setActiveBoard(state, { boardId: DEMO_BOARD_ID })).toBe(state);
    expect(setActiveBoard(state, { boardId: "nope" })).toBe(state);
  });
});
