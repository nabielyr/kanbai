import {
  addCard,
  createBoard,
  createEmptyState,
  DEFAULT_COLUMN_TITLES,
} from "@/lib/domain/board-ops";
import { createId } from "@/lib/domain/ids";
import type { PersistedState } from "@/lib/domain/types";

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
