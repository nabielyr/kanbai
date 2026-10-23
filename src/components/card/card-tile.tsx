import {
  CalendarClock,
  CircleCheck,
  Flame,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import { getChecklistProgress } from "@/lib/domain/checklist";
import { getDueLabel, getDueStatus } from "@/lib/domain/due";
import type { Card, Label, Priority } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { dueChipClass, dueEdgeClass, labelColorClass, priorityMeta } from "./card-styles";

const priorityIcon: Record<Priority, typeof Flame> = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
  urgent: Flame,
};

interface CardTileProps {
  card: Card;
  labels: Label[];
  isDone?: boolean;
  now: Date;
}

export function CardTile({ card, labels, isDone = false, now }: CardTileProps) {
  const cardLabels = card.labelIds
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is Label => Boolean(label));
  const progress = getChecklistProgress(card.checklist);
  const dueStatus = getDueStatus(card.dueDate, now, isDone);
  const priority = priorityMeta[card.priority];
  const PriorityIcon = priorityIcon[card.priority];

  return (
    <article
      className={cn(
        "bg-card text-card-foreground shadow-soft hover:shadow-lift rounded-lg border border-l-4 p-3 transition-shadow",
        dueEdgeClass[dueStatus],
      )}
    >
      {cardLabels.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1" aria-label="Labels">
          {cardLabels.map((label) => (
            <li
              key={label.id}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium",
                labelColorClass[label.color],
              )}
            >
              {label.name}
            </li>
          ))}
        </ul>
      )}

      <h3
        className={cn(
          "font-sans text-sm leading-snug font-semibold tracking-normal",
          isDone && "text-muted-foreground",
        )}
      >
        {card.title}
      </h3>

      {card.description && (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{card.description}</p>
      )}

      {progress.total > 0 && (
        <div className="mt-3">
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Checklist progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                progress.ratio === 1 ? "bg-label-mint-foreground" : "bg-primary",
              )}
              style={{ width: `${progress.ratio * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className={cn("inline-flex items-center gap-1 font-medium", priority.className)}>
          <PriorityIcon className="size-3.5" aria-hidden="true" />
          {priority.label}
        </span>

        {progress.total > 0 && (
          <span className="inline-flex items-center gap-1">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            {progress.done}/{progress.total}
          </span>
        )}

        {card.dueDate && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              dueChipClass[dueStatus],
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {getDueLabel(card.dueDate, now, isDone)}
          </span>
        )}
      </div>
    </article>
  );
}
