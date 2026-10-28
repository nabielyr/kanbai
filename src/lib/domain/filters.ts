import type { ColumnItems } from "./drag";
import { getDueStatus } from "./due";
import type { Card, Label, PersistedState, Priority } from "./types";

// Pure search & filter logic. Within a group the options are OR-ed (label A or label B);
// across groups they are AND-ed (has label A and is urgent and matches the search).

export const DUE_FILTERS = ["overdue", "today", "soon", "later", "none"] as const;
/** "none" means no due date at all; the others follow `getDueStatus`. */
export type DueFilter = (typeof DUE_FILTERS)[number];

export interface CardFilters {
  query: string;
  labelIds: string[];
  priorities: Priority[];
  due: DueFilter[];
}

export const EMPTY_FILTERS: CardFilters = { query: "", labelIds: [], priorities: [], due: [] };

export function hasActiveFilters(filters: CardFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.labelIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.due.length > 0
  );
}

/** Number of chosen filter options (the search text is not counted). */
export function countFilterOptions(filters: CardFilters): number {
  return filters.labelIds.length + filters.priorities.length + filters.due.length;
}

/** Lowercase without accents, so "cafe" finds "Café". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Every word of the query must appear in the title, description, labels or checklist. */
function matchesQuery(card: Card, labels: Label[], query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      card.title,
      card.description,
      ...card.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? ""),
      ...card.checklist.map((item) => item.title),
    ].join("\n"),
  );
  return words.every((word) => haystack.includes(word));
}

function matchesDue(card: Card, due: DueFilter[], now: Date, isDone: boolean): boolean {
  if (due.length === 0) return true;
  if (!card.dueDate) return due.includes("none");
  // Cards in a done column have no due status, so they only match "no due date" when undated.
  const status = getDueStatus(card.dueDate, now, isDone);
  return status !== "none" && due.includes(status);
}

export function cardMatchesFilters(
  card: Card,
  filters: CardFilters,
  context: { labels: Label[]; now: Date; isDone: boolean },
): boolean {
  return (
    (filters.labelIds.length === 0 || card.labelIds.some((id) => filters.labelIds.includes(id))) &&
    (filters.priorities.length === 0 || filters.priorities.includes(card.priority)) &&
    matchesDue(card, filters.due, context.now, context.isDone) &&
    matchesQuery(card, context.labels, filters.query)
  );
}

export interface FilteredBoard {
  /** Matching card ids per column, in display order. */
  visible: ColumnItems;
  shown: number;
  total: number;
}

/** Applies the filters to every column of a board. */
export function filterBoard(
  state: PersistedState,
  boardId: string,
  filters: CardFilters,
  now: Date,
): FilteredBoard {
  const board = state.boards[boardId];
  const visible: ColumnItems = {};
  let shown = 0;
  let total = 0;
  for (const columnId of board?.columnIds ?? []) {
    const column = state.columns[columnId];
    if (!column) continue;
    const context = { labels: board.labels, now, isDone: Boolean(column.isDone) };
    visible[columnId] = column.cardIds.filter((id) => {
      const card = state.cards[id];
      return card !== undefined && cardMatchesFilters(card, filters, context);
    });
    shown += visible[columnId].length;
    total += column.cardIds.length;
  }
  return { visible, shown, total };
}
