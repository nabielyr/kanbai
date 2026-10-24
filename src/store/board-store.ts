import { createStore, type StoreApi } from "zustand/vanilla";
import * as ops from "@/lib/domain/board-ops";
import { createId } from "@/lib/domain/ids";
import type { PersistedState } from "@/lib/domain/types";

export interface BoardActions {
  /** Returns the new card id, or null when the input was rejected (e.g. empty title). */
  addCard: (
    columnId: string,
    title: string,
    options?: { position?: "top" | "bottom"; fields?: Omit<ops.CardPatch, "title"> },
  ) => string | null;
  updateCard: (cardId: string, patch: ops.CardPatch) => void;
  /** Deletes a card and returns an `undo` function that puts it back, or null if nothing was deleted. */
  deleteCard: (cardId: string) => (() => void) | null;
  moveCard: (cardId: string, toColumnId: string, beforeCardId: string | null) => void;
  /** Returns the new column id, or null when the input was rejected. */
  addColumn: (boardId: string, title: string) => string | null;
  renameColumn: (columnId: string, title: string) => void;
  deleteColumn: (columnId: string) => void;
  moveColumn: (columnId: string, toIndex: number) => void;
  /** Replaces everything, e.g. after loading from storage or resetting the demo. */
  replaceState: (data: PersistedState) => void;
}

export interface BoardStoreState {
  data: PersistedState;
  actions: BoardActions;
}

export type BoardStore = StoreApi<BoardStoreState>;

export interface BoardStoreDeps {
  createId: () => string;
  now: () => string;
}

const defaultDeps: BoardStoreDeps = {
  createId,
  now: () => new Date().toISOString(),
};

export function createBoardStore(
  initialData: PersistedState,
  deps: BoardStoreDeps = defaultDeps,
): BoardStore {
  return createStore<BoardStoreState>()((set, get) => {
    /** Applies a pure op; only notifies subscribers when the state actually changed. */
    const apply = (op: (data: PersistedState) => PersistedState): boolean => {
      const prev = get().data;
      const next = op(prev);
      if (next === prev) return false;
      set({ data: next });
      return true;
    };

    return {
      data: initialData,
      actions: {
        addCard: (columnId, title, options) => {
          const id = deps.createId();
          const added = apply((d) =>
            ops.addCard(d, { columnId, id, title, now: deps.now(), ...options }),
          );
          return added ? id : null;
        },
        updateCard: (cardId, patch) => {
          apply((d) => ops.updateCard(d, { cardId, patch, now: deps.now() }));
        },
        deleteCard: (cardId) => {
          const before = get().data;
          const card = before.cards[cardId];
          const index = card ? (before.columns[card.columnId]?.cardIds.indexOf(cardId) ?? -1) : -1;
          if (!card || index === -1) return null;
          apply((d) => ops.deleteCard(d, { cardId, now: deps.now() }));
          return () => {
            apply((d) => ops.restoreCard(d, { card, index, now: deps.now() }));
          };
        },
        moveCard: (cardId, toColumnId, beforeCardId) => {
          apply((d) => ops.moveCard(d, { cardId, toColumnId, beforeCardId, now: deps.now() }));
        },
        addColumn: (boardId, title) => {
          const id = deps.createId();
          const added = apply((d) => ops.addColumn(d, { boardId, id, title, now: deps.now() }));
          return added ? id : null;
        },
        renameColumn: (columnId, title) => {
          apply((d) => ops.renameColumn(d, { columnId, title, now: deps.now() }));
        },
        deleteColumn: (columnId) => {
          apply((d) => ops.deleteColumn(d, { columnId, now: deps.now() }));
        },
        moveColumn: (columnId, toIndex) => {
          apply((d) => ops.moveColumn(d, { columnId, toIndex, now: deps.now() }));
        },
        replaceState: (data) => {
          set({ data });
        },
      },
    };
  });
}
