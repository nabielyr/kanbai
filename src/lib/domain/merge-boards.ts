import type { Card, Column, PersistedState } from "./types";

/**
 * Appends every board of `source` to `target` with fresh board, column and card ids, so
 * nothing can clash with boards already there (e.g. importing guest boards into an account).
 * Labels and checklist items keep their ids: they only need to be unique within a board/card.
 * The first imported board becomes the active one. `cardIds` maps each old card id to its copy.
 */
export function mergeBoards(
  target: PersistedState,
  source: PersistedState,
  makeId: () => string,
): { state: PersistedState; boardIds: string[]; cardIds: Record<string, string> } {
  const boards = { ...target.boards };
  const columns = { ...target.columns };
  const cards = { ...target.cards };
  const boardIds: string[] = [];
  const cardIdMap: Record<string, string> = {};

  for (const oldBoardId of source.boardOrder) {
    const board = source.boards[oldBoardId];
    if (!board) continue;
    const boardId = makeId();
    const columnIds: string[] = [];

    for (const oldColumnId of board.columnIds) {
      const column = source.columns[oldColumnId];
      if (!column) continue;
      const columnId = makeId();
      const cardIds: string[] = [];

      for (const oldCardId of column.cardIds) {
        const card = source.cards[oldCardId];
        if (!card) continue;
        const cardId = makeId();
        cards[cardId] = { ...card, id: cardId, boardId, columnId } satisfies Card;
        cardIdMap[oldCardId] = cardId;
        cardIds.push(cardId);
      }
      columns[columnId] = { ...column, id: columnId, boardId, cardIds } satisfies Column;
      columnIds.push(columnId);
    }

    boards[boardId] = { ...board, id: boardId, columnIds };
    boardIds.push(boardId);
  }

  if (boardIds.length === 0) return { state: target, boardIds, cardIds: cardIdMap };
  return {
    state: {
      ...target,
      boards,
      columns,
      cards,
      boardOrder: [...target.boardOrder, ...boardIds],
      activeBoardId: boardIds[0],
    },
    boardIds,
    cardIds: cardIdMap,
  };
}
