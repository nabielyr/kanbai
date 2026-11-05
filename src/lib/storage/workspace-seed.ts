import {
  addCard,
  createBoard,
  createEmptyState,
  DEFAULT_COLUMN_TITLES,
} from "@/lib/domain/board-ops";
import { createId } from "@/lib/domain/ids";
import type { Card, PersistedState } from "@/lib/domain/types";

/** A first-time user's workspace: one empty board plus a welcome card that teaches dragging. */
export function createWorkspaceState(
  now: Date = new Date(),
  makeId: () => string = createId,
): PersistedState {
  const timestamp = now.toISOString();
  const boardId = makeId();
  const columnIds = DEFAULT_COLUMN_TITLES.map(() => makeId());

  const withBoard = createBoard(createEmptyState(), {
    id: boardId,
    title: "My first board",
    columnIds,
    now: timestamp,
  });
  return addCard(withBoard, {
    columnId: columnIds[0],
    id: makeId(),
    title: "👋 Drag this card to In Progress",
    now: timestamp,
    fields: {
      description:
        "Then add your own cards with “+ Add card”, or create more boards from the header.",
      priority: "low",
    },
  });
}

/** The parts of the only board a person could have changed (ids and timestamps left out). */
function workspaceShape(state: PersistedState) {
  if (state.boardOrder.length !== 1) return null;
  const board = state.boards[state.boardOrder[0]];
  if (!board) return null;
  return {
    title: board.title,
    labels: board.labels.map((label) => [label.name, label.color]),
    columns: board.columnIds.map((columnId) => {
      const column = state.columns[columnId];
      return {
        title: column?.title,
        isDone: Boolean(column?.isDone),
        cards: (column?.cardIds ?? []).map((cardId) => {
          const card = { ...state.cards[cardId] } as Partial<Card>;
          delete card.id;
          delete card.boardId;
          delete card.columnId;
          delete card.createdAt;
          delete card.updatedAt;
          return card;
        }),
      };
    }),
  };
}

/** True when `state` is still exactly the starter workspace, so there's nothing to keep. */
export function isUntouchedWorkspace(state: PersistedState): boolean {
  const shape = workspaceShape(state);
  if (!shape) return false;
  let n = 0;
  const fresh = workspaceShape(createWorkspaceState(new Date(0), () => `seed-${++n}`));
  return JSON.stringify(shape) === JSON.stringify(fresh);
}
