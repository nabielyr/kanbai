import { beforeEach, describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import {
  addCard,
  addColumn,
  deleteCard,
  deleteColumn,
  MAX_TITLE_LENGTH,
  moveCard,
  moveColumn,
  renameColumn,
  updateCard,
} from "./board-ops";
import { findIntegrityIssues } from "./integrity";
import type { PersistedState } from "./types";

const NOW = "2026-10-24T10:00:00.000Z";
const TODO = "demo-col-todo";
const DOING = "demo-col-doing";
const DONE = "demo-col-done";

let state: PersistedState;
beforeEach(() => {
  state = createDemoState(new Date(2026, 9, 24));
});

const cardIds = (s: PersistedState, columnId: string) => s.columns[columnId].cardIds;
const columnIds = (s: PersistedState) => s.boards[DEMO_BOARD_ID].columnIds;

function expectConsistent(s: PersistedState) {
  expect(findIntegrityIssues(s)).toEqual([]);
}

describe("moveCard", () => {
  // To Do: portfolio, case-study, contact-bug, hosting
  it("reorders within a column (move down, before a later card)", () => {
    const next = moveCard(state, {
      cardId: "demo-card-portfolio",
      toColumnId: TODO,
      beforeCardId: "demo-card-hosting",
      now: NOW,
    });
    expect(cardIds(next, TODO)).toEqual([
      "demo-card-case-study",
      "demo-card-contact-bug",
      "demo-card-portfolio",
      "demo-card-hosting",
    ]);
    expectConsistent(next);
  });

  it("reorders within a column (move up to the top)", () => {
    const next = moveCard(state, {
      cardId: "demo-card-hosting",
      toColumnId: TODO,
      beforeCardId: "demo-card-portfolio",
      now: NOW,
    });
    expect(cardIds(next, TODO)[0]).toBe("demo-card-hosting");
    expect(cardIds(next, TODO)).toHaveLength(4);
    expectConsistent(next);
  });

  it("moves to the end of a column when beforeCardId is null", () => {
    const next = moveCard(state, {
      cardId: "demo-card-portfolio",
      toColumnId: TODO,
      beforeCardId: null,
      now: NOW,
    });
    expect(cardIds(next, TODO).at(-1)).toBe("demo-card-portfolio");
  });

  it("moves between columns and updates the card's columnId", () => {
    const next = moveCard(state, {
      cardId: "demo-card-contact-bug",
      toColumnId: DOING,
      beforeCardId: "demo-card-ci",
      now: NOW,
    });
    expect(cardIds(next, TODO)).not.toContain("demo-card-contact-bug");
    expect(cardIds(next, DOING)).toEqual([
      "demo-card-hero",
      "demo-card-contact-bug",
      "demo-card-ci",
    ]);
    expect(next.cards["demo-card-contact-bug"].columnId).toBe(DOING);
    expect(next.cards["demo-card-contact-bug"].updatedAt).toBe(NOW);
    expect(next.boards[DEMO_BOARD_ID].updatedAt).toBe(NOW);
    expectConsistent(next);
  });

  it("moves into an empty column", () => {
    const emptied = deleteCard(deleteCard(state, { cardId: "demo-card-palette", now: NOW }), {
      cardId: "demo-card-domain",
      now: NOW,
    });
    expect(cardIds(emptied, DONE)).toEqual([]);
    const next = moveCard(emptied, {
      cardId: "demo-card-hero",
      toColumnId: DONE,
      beforeCardId: null,
      now: NOW,
    });
    expect(cardIds(next, DONE)).toEqual(["demo-card-hero"]);
    expectConsistent(next);
  });

  it("appends when beforeCardId is not in the target column (e.g. hidden by a filter race)", () => {
    const next = moveCard(state, {
      cardId: "demo-card-hosting",
      toColumnId: DOING,
      beforeCardId: "demo-card-palette", // lives in Done, not In Progress
      now: NOW,
    });
    expect(cardIds(next, DOING).at(-1)).toBe("demo-card-hosting");
    expectConsistent(next);
  });

  it("keeps hidden cards in place when dropping between visible ones", () => {
    // Imagine a filter shows only portfolio and hosting; the user drops case-study before hosting.
    const next = moveCard(state, {
      cardId: "demo-card-case-study",
      toColumnId: TODO,
      beforeCardId: "demo-card-hosting",
      now: NOW,
    });
    // contact-bug (hidden) keeps its relative position before case-study's new slot.
    expect(cardIds(next, TODO)).toEqual([
      "demo-card-portfolio",
      "demo-card-contact-bug",
      "demo-card-case-study",
      "demo-card-hosting",
    ]);
  });

  it("returns the same state for no-op moves", () => {
    expect(
      moveCard(state, {
        cardId: "demo-card-portfolio",
        toColumnId: TODO,
        beforeCardId: "demo-card-case-study",
        now: NOW,
      }),
    ).toBe(state);
    expect(
      moveCard(state, {
        cardId: "demo-card-portfolio",
        toColumnId: TODO,
        beforeCardId: "demo-card-portfolio",
        now: NOW,
      }),
    ).toBe(state);
  });

  it("ignores unknown cards and columns", () => {
    expect(
      moveCard(state, { cardId: "nope", toColumnId: TODO, beforeCardId: null, now: NOW }),
    ).toBe(state);
    expect(
      moveCard(state, {
        cardId: "demo-card-portfolio",
        toColumnId: "nope",
        beforeCardId: null,
        now: NOW,
      }),
    ).toBe(state);
  });

  it("does not mutate the previous state", () => {
    const before = structuredClone(state);
    moveCard(state, {
      cardId: "demo-card-contact-bug",
      toColumnId: DOING,
      beforeCardId: null,
      now: NOW,
    });
    expect(state).toEqual(before);
  });
});

describe("cards", () => {
  it("adds a card at the bottom by default, with defaults", () => {
    const next = addCard(state, { columnId: DOING, id: "c1", title: "  New   task ", now: NOW });
    expect(cardIds(next, DOING).at(-1)).toBe("c1");
    expect(next.cards.c1).toMatchObject({
      title: "New task",
      boardId: DEMO_BOARD_ID,
      columnId: DOING,
      priority: "medium",
      dueDate: null,
      checklist: [],
      createdAt: NOW,
    });
    expectConsistent(next);
  });

  it("adds a card at the top when asked", () => {
    const next = addCard(state, {
      columnId: TODO,
      id: "c1",
      title: "Top",
      now: NOW,
      position: "top",
    });
    expect(cardIds(next, TODO)[0]).toBe("c1");
  });

  it("rejects empty titles and duplicate ids", () => {
    expect(addCard(state, { columnId: TODO, id: "c1", title: "   ", now: NOW })).toBe(state);
    expect(addCard(state, { columnId: TODO, id: "demo-card-hero", title: "Dup", now: NOW })).toBe(
      state,
    );
  });

  it("caps very long titles", () => {
    const next = addCard(state, { columnId: TODO, id: "c1", title: "x".repeat(500), now: NOW });
    expect(next.cards.c1.title).toHaveLength(MAX_TITLE_LENGTH);
  });

  it("updates fields, keeps a title, and drops unknown labels", () => {
    const next = updateCard(state, {
      cardId: "demo-card-hosting",
      patch: {
        description: "Vercel vs Netlify",
        priority: "urgent",
        labelIds: ["demo-label-dev", "ghost", "demo-label-dev"],
      },
      now: NOW,
    });
    expect(next.cards["demo-card-hosting"]).toMatchObject({
      description: "Vercel vs Netlify",
      priority: "urgent",
      labelIds: ["demo-label-dev"],
      updatedAt: NOW,
    });
    expect(
      updateCard(state, { cardId: "demo-card-hosting", patch: { title: " " }, now: NOW }),
    ).toBe(state);
    expectConsistent(next);
  });

  it("deletes a card from its column", () => {
    const next = deleteCard(state, { cardId: "demo-card-hero", now: NOW });
    expect(next.cards["demo-card-hero"]).toBeUndefined();
    expect(cardIds(next, DOING)).toEqual(["demo-card-ci"]);
    expectConsistent(next);
  });
});

describe("columns", () => {
  it("adds a column at the end", () => {
    const next = addColumn(state, {
      boardId: DEMO_BOARD_ID,
      id: "col1",
      title: "Review",
      now: NOW,
    });
    expect(columnIds(next).at(-1)).toBe("col1");
    expect(next.columns.col1).toEqual({
      id: "col1",
      boardId: DEMO_BOARD_ID,
      title: "Review",
      cardIds: [],
    });
    expectConsistent(next);
  });

  it("renames a column and ignores empty names", () => {
    const next = renameColumn(state, { columnId: TODO, title: "Backlog", now: NOW });
    expect(next.columns[TODO].title).toBe("Backlog");
    expect(renameColumn(state, { columnId: TODO, title: "  ", now: NOW })).toBe(state);
  });

  it("deletes a column together with its cards", () => {
    const next = deleteColumn(state, { columnId: DOING, now: NOW });
    expect(columnIds(next)).toEqual([TODO, DONE]);
    expect(next.columns[DOING]).toBeUndefined();
    expect(next.cards["demo-card-hero"]).toBeUndefined();
    expect(next.cards["demo-card-ci"]).toBeUndefined();
    expect(Object.keys(next.cards)).toHaveLength(6);
    expectConsistent(next);
  });

  it.each([
    [0, [DONE, TODO, DOING]],
    [1, [TODO, DONE, DOING]],
    [-5, [DONE, TODO, DOING]],
    [99, [TODO, DOING, DONE]],
  ])("moves a column to index %i", (toIndex, expected) => {
    const next = moveColumn(state, { columnId: DONE, toIndex, now: NOW });
    expect(columnIds(next)).toEqual(expected);
    expectConsistent(next);
  });

  it("returns the same state when a column doesn't actually move", () => {
    expect(moveColumn(state, { columnId: TODO, toIndex: 0, now: NOW })).toBe(state);
  });
});
