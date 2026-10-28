import { createStore, type StoreApi } from "zustand/vanilla";
import * as ops from "@/lib/domain/board-ops";
import * as checklist from "@/lib/domain/checklist";
import { createId } from "@/lib/domain/ids";
import type { ChecklistItem, Label, LabelColor, PersistedState } from "@/lib/domain/types";

export interface BoardActions {
  /** Creates a board with default columns and makes it active. Returns its id, or null. */
  createBoard: (title: string) => string | null;
  renameBoard: (boardId: string, title: string) => void;
  /** Deletes a board with all of its columns and cards. */
  deleteBoard: (boardId: string) => void;
  setActiveBoard: (boardId: string) => void;
  /** Returns the new label id, or null when rejected (blank, duplicate name, board full). */
  addLabel: (boardId: string, name: string, color: LabelColor) => string | null;
  /** Returns false when rejected (e.g. blank or duplicate name). */
  updateLabel: (
    boardId: string,
    labelId: string,
    patch: Partial<Pick<Label, "name" | "color">>,
  ) => boolean;
  /** Deletes a label and removes it from all cards. */
  deleteLabel: (boardId: string, labelId: string) => void;
  /** Returns the new card id, or null when the input was rejected (e.g. empty title). */
  addCard: (
    columnId: string,
    title: string,
    options?: { position?: "top" | "bottom"; fields?: Omit<ops.CardPatch, "title"> },
  ) => string | null;
  updateCard: (cardId: string, patch: ops.CardPatch) => void;
  /** Returns the new checklist item id, or null when rejected (blank title, list full). */
  addChecklistItem: (cardId: string, title: string) => string | null;
  toggleChecklistItem: (cardId: string, itemId: string) => void;
  renameChecklistItem: (cardId: string, itemId: string, title: string) => void;
  deleteChecklistItem: (cardId: string, itemId: string) => void;
  moveChecklistItem: (cardId: string, itemId: string, toIndex: number) => void;
  /** Deletes a card and returns an `undo` function that puts it back, or null if nothing was deleted. */
  deleteCard: (cardId: string) => (() => void) | null;
  moveCard: (cardId: string, toColumnId: string, beforeCardId: string | null) => void;
  /** Returns the new column id, or null when the input was rejected. */
  addColumn: (boardId: string, title: string) => string | null;
  renameColumn: (columnId: string, title: string) => void;
  setColumnDone: (columnId: string, isDone: boolean) => void;
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

    /** Applies a pure checklist op to one card's checklist. */
    const applyChecklist = (
      cardId: string,
      op: (items: ChecklistItem[]) => ChecklistItem[],
    ): boolean =>
      apply((d) => {
        const card = d.cards[cardId];
        const next = card ? op(card.checklist) : undefined;
        if (!card || next === card.checklist) return d;
        return ops.updateCard(d, { cardId, patch: { checklist: next }, now: deps.now() });
      });

    return {
      data: initialData,
      actions: {
        createBoard: (title) => {
          const id = deps.createId();
          const columnIds = ops.DEFAULT_COLUMN_TITLES.map(() => deps.createId());
          const created = apply((d) =>
            ops.createBoard(d, { id, title, columnIds, now: deps.now() }),
          );
          return created ? id : null;
        },
        renameBoard: (boardId, title) => {
          apply((d) => ops.renameBoard(d, { boardId, title, now: deps.now() }));
        },
        deleteBoard: (boardId) => {
          apply((d) => ops.deleteBoard(d, { boardId }));
        },
        setActiveBoard: (boardId) => {
          apply((d) => ops.setActiveBoard(d, { boardId }));
        },
        addLabel: (boardId, name, color) => {
          const id = deps.createId();
          const added = apply((d) =>
            ops.addLabel(d, { boardId, id, name, color, now: deps.now() }),
          );
          return added ? id : null;
        },
        updateLabel: (boardId, labelId, patch) =>
          apply((d) => ops.updateLabel(d, { boardId, labelId, patch, now: deps.now() })),
        deleteLabel: (boardId, labelId) => {
          apply((d) => ops.deleteLabel(d, { boardId, labelId, now: deps.now() }));
        },
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
        addChecklistItem: (cardId, title) => {
          const id = deps.createId();
          const added = applyChecklist(cardId, (items) =>
            checklist.addChecklistItem(items, { id, title }),
          );
          return added ? id : null;
        },
        toggleChecklistItem: (cardId, itemId) => {
          applyChecklist(cardId, (items) => checklist.toggleChecklistItem(items, { itemId }));
        },
        renameChecklistItem: (cardId, itemId, title) => {
          applyChecklist(cardId, (items) =>
            checklist.renameChecklistItem(items, { itemId, title }),
          );
        },
        deleteChecklistItem: (cardId, itemId) => {
          applyChecklist(cardId, (items) => checklist.deleteChecklistItem(items, { itemId }));
        },
        moveChecklistItem: (cardId, itemId, toIndex) => {
          applyChecklist(cardId, (items) =>
            checklist.moveChecklistItem(items, { itemId, toIndex }),
          );
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
        setColumnDone: (columnId, isDone) => {
          apply((d) => ops.setColumnDone(d, { columnId, isDone, now: deps.now() }));
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
