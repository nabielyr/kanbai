import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

export type DueStatus = "none" | "overdue" | "today" | "soon" | "later";

/** Cards due within this many days (after today) count as "soon". */
export const DUE_SOON_DAYS = 2;

/** Parses a `yyyy-MM-dd` date as a local calendar date (never shifted by timezone). */
function parseDueDate(dueDate: string): Date | null {
  const date = parseISO(dueDate);
  return isValid(date) ? date : null;
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
