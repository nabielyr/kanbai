import { getDueStatus, type DueStatus } from "./due";
import type { Card, PersistedState, Priority } from "./types";

// "What should I do next?" — a deterministic, free pick: no AI involved.
// Score = priority weight + due urgency + a bonus for work already in progress.
// Cards in done columns are never suggested.

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 40,
  high: 25,
  medium: 10,
  low: 0,
};

export const DUE_WEIGHT: Record<DueStatus, number> = {
  overdue: 50,
  today: 35,
  soon: 20,
  later: 5,
  none: 0,
};

/** Finishing something already started usually beats starting something new. */
export const IN_PROGRESS_BONUS = 15;

const DUE_REASONS: Partial<Record<DueStatus, string>> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
};

const PRIORITY_REASONS: Partial<Record<Priority, string>> = {
  urgent: "Urgent priority",
  high: "High priority",
};

export interface ScoredCard {
  cardId: string;
  score: number;
  /** Short, human-readable reasons, most important first. */
  reasons: string[];
}

export function scoreCard(card: Card, context: { now: Date; inProgress: boolean }): ScoredCard {
  const due = getDueStatus(card.dueDate, context.now);
  const reasons = [
    DUE_REASONS[due],
    PRIORITY_REASONS[card.priority],
    context.inProgress ? "Already in progress" : undefined,
  ].filter((r): r is string => r !== undefined);
  return {
    cardId: card.id,
    score:
      PRIORITY_WEIGHT[card.priority] +
      DUE_WEIGHT[due] +
      (context.inProgress ? IN_PROGRESS_BONUS : 0),
    reasons,
  };
}

/**
 * The best card to work on next, or null when nothing is left. Only `candidateIds` are
 * considered when given (e.g. the cards visible under the current filters).
 * Ties go to the earlier due date, then to the card placed first on the board.
 */
export function pickNextTask(
  state: PersistedState,
  boardId: string,
  now: Date,
  candidateIds?: ReadonlySet<string>,
): ScoredCard | null {
  const board = state.boards[boardId];
  if (!board) return null;

  let best: { scored: ScoredCard; dueDate: string | null } | null = null;
  for (const [columnIndex, columnId] of board.columnIds.entries()) {
    const column = state.columns[columnId];
    if (!column || column.isDone) continue;
    // A column after the first one (and not done) means the work has started.
    const inProgress = columnIndex > 0;
    for (const cardId of column.cardIds) {
      const card = state.cards[cardId];
      if (!card || (candidateIds && !candidateIds.has(cardId))) continue;
      const scored = scoreCard(card, { now, inProgress });
      if (!best || isBetter(scored, card.dueDate, best.scored, best.dueDate)) {
        best = { scored, dueDate: card.dueDate };
      }
    }
  }
  return best?.scored ?? null;
}

/** Strictly better only: an equal card found later on the board never replaces an earlier one. */
function isBetter(a: ScoredCard, aDue: string | null, b: ScoredCard, bDue: string | null): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (aDue && bDue) return aDue < bDue; // yyyy-MM-dd sorts as text
  return aDue !== null && bDue === null;
}
