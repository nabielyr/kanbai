import type { PersistedState } from "./types";

/**
 * Checks that the normalized maps and the ordering arrays agree with each other.
 * Returns a list of human-readable problems; an empty list means the state is consistent.
 */
export function findIntegrityIssues(state: PersistedState): string[] {
  const issues: string[] = [];
  const seenColumns = new Set<string>();
  const seenCards = new Set<string>();

  for (const boardId of state.boardOrder) {
    if (!state.boards[boardId]) issues.push(`boardOrder references missing board ${boardId}`);
  }
  for (const boardId of Object.keys(state.boards)) {
    if (!state.boardOrder.includes(boardId))
      issues.push(`board ${boardId} missing from boardOrder`);
  }
  if (state.activeBoardId !== null && !state.boards[state.activeBoardId]) {
    issues.push(`activeBoardId references missing board ${state.activeBoardId}`);
  }

  for (const board of Object.values(state.boards)) {
    const labelIds = new Set(board.labels.map((l) => l.id));

    for (const columnId of board.columnIds) {
      const column = state.columns[columnId];
      if (!column) {
        issues.push(`board ${board.id} references missing column ${columnId}`);
        continue;
      }
      if (seenColumns.has(columnId)) issues.push(`column ${columnId} listed more than once`);
      seenColumns.add(columnId);
      if (column.boardId !== board.id) issues.push(`column ${columnId} has wrong boardId`);

      for (const cardId of column.cardIds) {
        const card = state.cards[cardId];
        if (!card) {
          issues.push(`column ${columnId} references missing card ${cardId}`);
          continue;
        }
        if (seenCards.has(cardId)) issues.push(`card ${cardId} listed more than once`);
        seenCards.add(cardId);
        if (card.columnId !== columnId) issues.push(`card ${cardId} has wrong columnId`);
        if (card.boardId !== board.id) issues.push(`card ${cardId} has wrong boardId`);
        for (const labelId of card.labelIds) {
          if (!labelIds.has(labelId)) issues.push(`card ${cardId} uses unknown label ${labelId}`);
        }
      }
    }
  }

  for (const columnId of Object.keys(state.columns)) {
    if (!seenColumns.has(columnId)) issues.push(`column ${columnId} is orphaned`);
  }
  for (const cardId of Object.keys(state.cards)) {
    if (!seenCards.has(cardId)) issues.push(`card ${cardId} is orphaned`);
  }

  return issues;
}
