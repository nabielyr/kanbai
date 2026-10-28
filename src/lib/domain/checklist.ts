import type { ChecklistItem } from "./types";

export interface ChecklistProgress {
  done: number;
  total: number;
  /** 0..1; 0 for an empty checklist. */
  ratio: number;
}

export function getChecklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

// Pure, immutable checklist operations. Like board-ops, invalid input or a no-op
// returns the same array, so callers can skip saving when nothing changed.

export const MAX_CHECKLIST_ITEMS = 200;
export const MAX_CHECKLIST_TITLE_LENGTH = 300;

function cleanItemTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, MAX_CHECKLIST_TITLE_LENGTH);
}

export function addChecklistItem(
  items: ChecklistItem[],
  input: { id: string; title: string },
): ChecklistItem[] {
  const title = cleanItemTitle(input.title);
  if (!title || items.length >= MAX_CHECKLIST_ITEMS || items.some((i) => i.id === input.id)) {
    return items;
  }
  return [...items, { id: input.id, title, done: false, source: "manual" }];
}

export function toggleChecklistItem(
  items: ChecklistItem[],
  input: { itemId: string },
): ChecklistItem[] {
  if (!items.some((i) => i.id === input.itemId)) return items;
  return items.map((i) => (i.id === input.itemId ? { ...i, done: !i.done } : i));
}

/** A blank title is rejected: an item always keeps a title. */
export function renameChecklistItem(
  items: ChecklistItem[],
  input: { itemId: string; title: string },
): ChecklistItem[] {
  const title = cleanItemTitle(input.title);
  const item = items.find((i) => i.id === input.itemId);
  if (!item || !title || title === item.title) return items;
  return items.map((i) => (i.id === item.id ? { ...i, title } : i));
}

export function deleteChecklistItem(
  items: ChecklistItem[],
  input: { itemId: string },
): ChecklistItem[] {
  const next = items.filter((i) => i.id !== input.itemId);
  return next.length === items.length ? items : next;
}

/** Moves an item to `toIndex` (clamped to the valid range). */
export function moveChecklistItem(
  items: ChecklistItem[],
  input: { itemId: string; toIndex: number },
): ChecklistItem[] {
  const fromIndex = items.findIndex((i) => i.id === input.itemId);
  if (fromIndex === -1) return items;
  const rest = items.filter((_, index) => index !== fromIndex);
  const toIndex = Math.max(0, Math.min(Math.trunc(input.toIndex), rest.length));
  if (toIndex === fromIndex) return items;
  return [...rest.slice(0, toIndex), items[fromIndex], ...rest.slice(toIndex)];
}
