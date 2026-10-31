import { clampEstimate, cleanSubtaskTitle, DEFAULT_ESTIMATE_MINUTES } from "./normalize";
import type { Subtask } from "./schemas";

// The editable preview of AI subtasks in the Chunk it dialog. Nothing here is saved:
// the draft lives in the dialog until the user accepts it. Pure, like the domain ops —
// unknown ids or no-op edits return the same array.

export interface DraftSubtask {
  id: string;
  title: string;
  estimateMinutes: number;
}

/** Room for a few hand-added steps on top of the AI's maximum. */
export const MAX_DRAFT_ITEMS = 20;

export function draftFromSubtasks(subtasks: Subtask[], createId: () => string): DraftSubtask[] {
  return [...subtasks]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: createId(), title: s.title, estimateMinutes: s.estimateMinutes }));
}

/** A blank title is rejected (an item keeps its title); estimates are clamped to 5-minute steps. */
export function updateDraftItem(
  items: DraftSubtask[],
  id: string,
  patch: Partial<Pick<DraftSubtask, "title" | "estimateMinutes">>,
): DraftSubtask[] {
  const item = items.find((i) => i.id === id);
  if (!item) return items;

  const next = { ...item };
  if (patch.title !== undefined) {
    const title = cleanSubtaskTitle(patch.title);
    if (!title) return items;
    next.title = title;
  }
  if (patch.estimateMinutes !== undefined) {
    if (!Number.isFinite(patch.estimateMinutes)) return items;
    next.estimateMinutes = clampEstimate(patch.estimateMinutes);
  }
  if (next.title === item.title && next.estimateMinutes === item.estimateMinutes) return items;
  return items.map((i) => (i.id === id ? next : i));
}

export function removeDraftItem(items: DraftSubtask[], id: string): DraftSubtask[] {
  const next = items.filter((i) => i.id !== id);
  return next.length === items.length ? items : next;
}

export function addDraftItem(
  items: DraftSubtask[],
  input: { id: string; title: string; estimateMinutes?: number },
): DraftSubtask[] {
  const title = cleanSubtaskTitle(input.title);
  if (!title || items.length >= MAX_DRAFT_ITEMS || items.some((i) => i.id === input.id)) {
    return items;
  }
  return [
    ...items,
    {
      id: input.id,
      title,
      estimateMinutes: clampEstimate(input.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES),
    },
  ];
}

/** Moves an item to `toIndex` (clamped to the valid range). */
export function moveDraftItem(items: DraftSubtask[], id: string, toIndex: number): DraftSubtask[] {
  const fromIndex = items.findIndex((i) => i.id === id);
  if (fromIndex === -1) return items;
  const rest = items.filter((i) => i.id !== id);
  const to = Math.max(0, Math.min(Math.trunc(toIndex), rest.length));
  if (to === fromIndex) return items;
  return [...rest.slice(0, to), items[fromIndex], ...rest.slice(to)];
}

export function getDraftTotalMinutes(items: DraftSubtask[]): number {
  return items.reduce((sum, item) => sum + item.estimateMinutes, 0);
}

/** "45 min", "1 h", "2 h 15 min". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
