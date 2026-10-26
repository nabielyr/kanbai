import { Flame, SignalHigh, SignalLow, SignalMedium, type LucideIcon } from "lucide-react";
import type { DueStatus } from "@/lib/domain/due";
import type { LabelColor, Priority } from "@/lib/domain/types";

// Full class strings only — Tailwind can't see classes built from template strings.

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

export const dueChipClass: Record<DueStatus, string> = {
  none: "bg-muted text-muted-foreground",
  later: "bg-muted text-muted-foreground",
  soon: "bg-due-soon-soft text-due-soon",
  today: "bg-due-today-soft text-due-today",
  overdue: "bg-due-overdue-soft text-due-overdue",
};

export const dueEdgeClass: Record<DueStatus, string> = {
  none: "border-l-transparent",
  later: "border-l-transparent",
  soon: "border-l-due-soon",
  today: "border-l-due-today",
  overdue: "border-l-due-overdue",
};

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
