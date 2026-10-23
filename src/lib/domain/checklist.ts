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
