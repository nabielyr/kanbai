import { Flame, SignalHigh, SignalLow, SignalMedium, type LucideIcon } from "lucide-react";
import type { DueStatus } from "@/lib/domain/due";
import type { LabelColor, Priority } from "@/lib/domain/types";

// Full class strings only: Tailwind can't see classes built from template strings.

export const labelColorClass: Record<LabelColor, string> = {
  mint: "bg-label-mint text-label-mint-foreground",
  sky: "bg-label-sky text-label-sky-foreground",
  lilac: "bg-label-lilac text-label-lilac-foreground",
  peach: "bg-label-peach text-label-peach-foreground",
  lemon: "bg-label-lemon text-label-lemon-foreground",
  rose: "bg-label-rose text-label-rose-foreground",
  sage: "bg-label-sage text-label-sage-foreground",
  slate: "bg-label-slate text-label-slate-foreground",
};

/** Background only, for color swatches. */
export const labelSwatchClass: Record<LabelColor, string> = {
  mint: "bg-label-mint",
  sky: "bg-label-sky",
  lilac: "bg-label-lilac",
  peach: "bg-label-peach",
  lemon: "bg-label-lemon",
  rose: "bg-label-rose",
  sage: "bg-label-sage",
  slate: "bg-label-slate",
};

export const dueChipClass: Record<DueStatus, string> = {
  none: "bg-muted text-muted-foreground",
  later: "bg-muted text-muted-foreground",
  soon: "bg-due-soon-soft text-due-soon",
  today: "bg-due-today-soft text-due-today",
  overdue: "bg-due-overdue-soft text-due-overdue",
};

/** The tape holding a card up, colored by how urgent it is. No tape when nothing's due soon. */
export const dueTapeClass: Record<DueStatus, string | null> = {
  none: null,
  later: null,
  soon: "bg-tape-soon",
  today: "bg-tape-today",
  overdue: "bg-tape-overdue",
};

const TAPE_TILTS = [-3, 2, -1.5, 3, -2.5, 1.5];

/** Each card's tape sits at its own slight angle, like it was stuck on by hand. */
export function tapeTilt(cardId: string): number {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) hash = (hash * 31 + cardId.charCodeAt(i)) >>> 0;
  return TAPE_TILTS[hash % TAPE_TILTS.length];
}

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "text-muted-foreground" },
  medium: { label: "Medium", className: "text-label-sky-foreground" },
  high: { label: "High", className: "text-label-peach-foreground" },
  urgent: { label: "Urgent", className: "text-label-rose-foreground" },
};

export const priorityIcon: Record<Priority, LucideIcon> = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
  urgent: Flame,
};
