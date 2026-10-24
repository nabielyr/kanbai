import type { Board, Card, Column, PersistedState } from "./types";

// Pure, immutable operations on the normalized state.
// Callers pass ids and timestamps in, so every operation is deterministic and easy to test.
// Unknown ids or invalid input return the state unchanged instead of throwing,
// which keeps the UI safe against races (e.g. a card deleted mid-drag).

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;

function cleanTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH);
}

function touchBoard(state: PersistedState, boardId: string, now: string): PersistedState["boards"] {
  const board = state.boards[boardId];
  return board ? { ...state.boards, [boardId]: { ...board, updatedAt: now } } : state.boards;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/** Inserts `id` before `beforeId`, or at the end when `beforeId` is null or not in the list. */
function insertBefore(ids: string[], id: string, beforeId: string | null): string[] {
  const index = beforeId === null ? -1 : ids.indexOf(beforeId);
  if (index === -1) return [...ids, id];
  return [...ids.slice(0, index), id, ...ids.slice(index)];
}

// ---------- Columns ----------

export function addColumn(
  state: PersistedState,
  input: { boardId: string; id: string; title: string; now: string },
): PersistedState {
  const board = state.boards[input.boardId];
  const title = cleanTitle(input.title);
  if (!board || !title || state.columns[input.id]) return state;

  const column: Column = { id: input.id, boardId: board.id, title, cardIds: [] };
  return {
    ...state,
    columns: { ...state.columns, [column.id]: column },
    boards: {
      ...state.boards,
      [board.id]: { ...board, columnIds: [...board.columnIds, column.id], updatedAt: input.now },
    },
  };
}

export function renameColumn(
  state: PersistedState,
  input: { columnId: string; title: string; now: string },
): PersistedState {
  const column = state.columns[input.columnId];
  const title = cleanTitle(input.title);
  if (!column || !title || title === column.title) return state;

  return {
    ...state,
    columns: { ...state.columns, [column.id]: { ...column, title } },
    boards: touchBoard(state, column.boardId, input.now),
  };
}

/** Deletes a column together with all of its cards. */
export function deleteColumn(
  state: PersistedState,
  input: { columnId: string; now: string },
): PersistedState {
  const column = state.columns[input.columnId];
  const board = column && state.boards[column.boardId];
  if (!column || !board) return state;

  const cards = { ...state.cards };
  for (const cardId of column.cardIds) delete cards[cardId];

  return {
    ...state,
    cards,
    columns: withoutKey(state.columns, column.id),
    boards: {
      ...state.boards,
      [board.id]: {
        ...board,
        columnIds: board.columnIds.filter((id) => id !== column.id),
        updatedAt: input.now,
      },
    },
  };
}

/** Moves a column to `toIndex` within its board (clamped to the valid range). */
export function moveColumn(
  state: PersistedState,
  input: { columnId: string; toIndex: number; now: string },
): PersistedState {
  const column = state.columns[input.columnId];
  const board = column && state.boards[column.boardId];
  if (!column || !board) return state;

  const fromIndex = board.columnIds.indexOf(column.id);
  const rest = board.columnIds.filter((id) => id !== column.id);
  const toIndex = Math.max(0, Math.min(Math.trunc(input.toIndex), rest.length));
  if (toIndex === fromIndex) return state;

  const columnIds = [...rest.slice(0, toIndex), column.id, ...rest.slice(toIndex)];
  return {
    ...state,
    boards: { ...state.boards, [board.id]: { ...board, columnIds, updatedAt: input.now } },
  };
}

// ---------- Cards ----------

export type CardPatch = Partial<
  Pick<Card, "title" | "description" | "priority" | "labelIds" | "dueDate" | "checklist">
>;

export function addCard(
  state: PersistedState,
  input: {
    columnId: string;
    id: string;
    title: string;
    now: string;
    position?: "top" | "bottom";
    fields?: Omit<CardPatch, "title">;
  },
): PersistedState {
  const column = state.columns[input.columnId];
  const title = cleanTitle(input.title);
  if (!column || !title || state.cards[input.id]) return state;

  const card: Card = {
    id: input.id,
    boardId: column.boardId,
    columnId: column.id,
    title,
    description: "",
    priority: "medium",
    labelIds: [],
    dueDate: null,
    checklist: [],
    ...input.fields,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const cardIds =
    input.position === "top" ? [card.id, ...column.cardIds] : [...column.cardIds, card.id];

  return {
    ...state,
    cards: { ...state.cards, [card.id]: card },
    columns: { ...state.columns, [column.id]: { ...column, cardIds } },
    boards: touchBoard(state, column.boardId, input.now),
  };
}

export function updateCard(
  state: PersistedState,
  input: { cardId: string; patch: CardPatch; now: string },
): PersistedState {
  const card = state.cards[input.cardId];
  if (!card) return state;

  const patch: CardPatch = { ...input.patch };
  if (patch.title !== undefined) {
    const title = cleanTitle(patch.title);
    if (!title) return state; // a card always keeps a title
    patch.title = title;
  }
  if (patch.description !== undefined) {
    patch.description = patch.description.slice(0, MAX_DESCRIPTION_LENGTH);
  }
  if (patch.labelIds !== undefined) {
    const known = new Set(state.boards[card.boardId]?.labels.map((l) => l.id));
    patch.labelIds = [...new Set(patch.labelIds)].filter((id) => known.has(id));
  }

  return {
    ...state,
    cards: { ...state.cards, [card.id]: { ...card, ...patch, updatedAt: input.now } },
    boards: touchBoard(state, card.boardId, input.now),
  };
}

export function deleteCard(
  state: PersistedState,
  input: { cardId: string; now: string },
): PersistedState {
  const card = state.cards[input.cardId];
  const column = card && state.columns[card.columnId];
  if (!card || !column) return state;

  return {
    ...state,
    cards: withoutKey(state.cards, card.id),
    columns: {
      ...state.columns,
      [column.id]: { ...column, cardIds: column.cardIds.filter((id) => id !== card.id) },
    },
    boards: touchBoard(state, card.boardId, input.now),
  };
}

/**
 * Puts a previously deleted card back at `index` in its column (used by "Undo").
 * Ignored if the card already exists or its column has been deleted meanwhile.
 */
export function restoreCard(
  state: PersistedState,
  input: { card: Card; index: number; now: string },
): PersistedState {
  const { card } = input;
  const column = state.columns[card.columnId];
  if (state.cards[card.id] || !column || column.boardId !== card.boardId) return state;

  const index = Math.max(0, Math.min(Math.trunc(input.index), column.cardIds.length));
  const cardIds = [...column.cardIds.slice(0, index), card.id, ...column.cardIds.slice(index)];
  return {
    ...state,
    cards: { ...state.cards, [card.id]: card },
    columns: { ...state.columns, [column.id]: { ...column, cardIds } },
    boards: touchBoard(state, card.boardId, input.now),
  };
}

/**
 * Moves a card into `toColumnId`, placing it before `beforeCardId` (or at the end when null).
 * Positioning by neighbour id instead of index keeps drops correct even when a search or
 * filter hides some cards in the target column.
 */
export function moveCard(
  state: PersistedState,
  input: { cardId: string; toColumnId: string; beforeCardId: string | null; now: string },
): PersistedState {
  const card = state.cards[input.cardId];
  const from = card && state.columns[card.columnId];
  const to = state.columns[input.toColumnId];
  if (!card || !from || !to || to.boardId !== card.boardId) return state;
  if (input.beforeCardId === card.id) return state;

  const fromIds = from.cardIds.filter((id) => id !== card.id);
  const baseToIds = from.id === to.id ? fromIds : to.cardIds;
  const toIds = insertBefore(baseToIds, card.id, input.beforeCardId);

  const unchanged =
    from.id === to.id &&
    toIds.length === from.cardIds.length &&
    toIds.every((id, i) => id === from.cardIds[i]);
  if (unchanged) return state;

  const columns: Record<string, Column> = { ...state.columns, [to.id]: { ...to, cardIds: toIds } };
  if (from.id !== to.id) columns[from.id] = { ...from, cardIds: fromIds };

  return {
    ...state,
    columns,
    cards: {
      ...state.cards,
      [card.id]: { ...card, columnId: to.id, updatedAt: input.now },
    },
    boards: touchBoard(state, card.boardId, input.now),
  };
}

/** Columns of a board, in order. */
export function getBoardColumns(state: PersistedState, boardId: string): Column[] {
  const board: Board | undefined = state.boards[boardId];
  return board ? board.columnIds.map((id) => state.columns[id]).filter(Boolean) : [];
}

/** Cards of a column, in order. */
export function getColumnCards(state: PersistedState, columnId: string): Card[] {
  const column = state.columns[columnId];
  return column ? column.cardIds.map((id) => state.cards[id]).filter(Boolean) : [];
}
