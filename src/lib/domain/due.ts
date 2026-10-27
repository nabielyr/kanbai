import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

export type DueStatus = "none" | "overdue" | "today" | "soon" | "later";

/** Cards due within this many days (after today) count as "soon". */
export const DUE_SOON_DAYS = 2;

/** Parses a `yyyy-MM-dd` date as a local calendar date (never shifted by timezone). */
function parseDueDate(dueDate: string): Date | null {
  const date = parseISO(dueDate);
  return isValid(date) ? date : null;
}

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in `yyyy-MM-dd` form (rejects e.g. `2026-02-30`). */
export function isValidDueDate(value: string): boolean {
  if (!DUE_DATE_PATTERN.test(value)) return false;
  const date = parseDueDate(value);
  return date !== null && format(date, "yyyy-MM-dd") === value;
}

/** Formats a local date as a due date (`yyyy-MM-dd`). */
export function toDueDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Quick picks for the due date picker, relative to `now`. */
export function getDuePresets(now: Date): { label: string; dueDate: string }[] {
  return [
    { label: "Today", dueDate: toDueDate(now) },
    { label: "Tomorrow", dueDate: toDueDate(addDays(now, 1)) },
    { label: "Next week", dueDate: toDueDate(addDays(now, 7)) },
  ];
}

/**
 * How urgent a due date is relative to `now`, in the viewer's local calendar.
 * Cards in a "done" column are never flagged.
 */
export function getDueStatus(dueDate: string | null, now: Date, isDone = false): DueStatus {
  if (!dueDate || isDone) return "none";
  const date = parseDueDate(dueDate);
  if (!date) return "none";

  const days = differenceInCalendarDays(date, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "later";
}

/** Short text for a due chip: "Overdue", "Today", "Tomorrow", "In 2 days" or "Oct 29". */
export function getDueLabel(dueDate: string, now: Date, isDone = false): string {
  const date = parseDueDate(dueDate);
  if (!date) return "";
  const shortDate = format(date, "MMM d");
  if (isDone) return shortDate;

  const days = differenceInCalendarDays(date, now);
  if (days < 0) return days === -1 ? "Overdue · yesterday" : `Overdue · ${shortDate}`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= DUE_SOON_DAYS) return `In ${days} days`;
  return shortDate;
}
