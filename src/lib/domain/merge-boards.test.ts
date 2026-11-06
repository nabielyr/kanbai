import { describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/storage/demo-seed";
import { createWorkspaceState } from "@/lib/storage/workspace-seed";
import { findIntegrityIssues } from "./integrity";
import { mergeBoards } from "./merge-boards";

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};

describe("mergeBoards", () => {
  const target = createWorkspaceState(
    new Date(2026, 10, 5),
    (() => {
      let n = 0;
      return () => `acct-${++n}`;
    })(),
  );
  const source = createDemoState(new Date(2026, 10, 5));

  it("appends the source boards with fresh ids and makes the first one active", () => {
    const { state, boardIds } = mergeBoards(target, source, ids());

    expect(state.boardOrder).toEqual([...target.boardOrder, ...boardIds]);
    expect(state.activeBoardId).toBe(boardIds[0]);
    expect(findIntegrityIssues(state)).toEqual([]);

    const sourceBoard = source.boards[source.boardOrder[0]];
    const imported = state.boards[boardIds[0]];
    expect(imported.title).toBe(sourceBoard.title);
    expect(imported.labels).toEqual(sourceBoard.labels);
    expect(imported.columnIds).toHaveLength(sourceBoard.columnIds.length);
    for (const id of [...imported.columnIds, boardIds[0]])
      expect(source.columns[id]).toBeUndefined();
  });

  it("maps every old card id to its copy", () => {
    const { state, cardIds } = mergeBoards(target, source, ids());

    expect(Object.keys(cardIds).sort()).toEqual(Object.keys(source.cards).sort());
    for (const [oldId, newId] of Object.entries(cardIds)) {
      expect(state.cards[newId].title).toBe(source.cards[oldId].title);
      expect(source.cards[newId]).toBeUndefined();
    }
  });

  it("keeps every card's content, order and column", () => {
    const { state, boardIds } = mergeBoards(target, source, ids());
    const sourceBoard = source.boards[source.boardOrder[0]];
    const imported = state.boards[boardIds[0]];

    imported.columnIds.forEach((columnId, i) => {
      const before = source.columns[sourceBoard.columnIds[i]];
      const after = state.columns[columnId];
      expect(after).toMatchObject({ title: before.title, boardId: imported.id });
      expect(Boolean(after.isDone)).toBe(Boolean(before.isDone));
      expect(after.cardIds.map((id) => state.cards[id].title)).toEqual(
        before.cardIds.map((id) => source.cards[id].title),
      );
      for (const cardId of after.cardIds) {
        expect(state.cards[cardId]).toMatchObject({ columnId, boardId: imported.id });
      }
    });
  });

  it("can import the same boards twice without clashing", () => {
    const once = mergeBoards(target, source, ids()).state;
    let n = 100;
    const twice = mergeBoards(once, source, () => `again-${++n}`).state;
    expect(twice.boardOrder).toHaveLength(3);
    expect(findIntegrityIssues(twice)).toEqual([]);
  });

  it("leaves the target unchanged when there is nothing to import", () => {
    const empty = {
      ...source,
      boards: {},
      columns: {},
      cards: {},
      boardOrder: [],
      activeBoardId: null,
    };
    expect(mergeBoards(target, empty, ids()).state).toBe(target);
  });
});
