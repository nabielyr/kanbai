"use client";

import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDueLabel, getDuePresets, getDueStatus, isValidDueDate } from "@/lib/domain/due";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { dueChipClass } from "./card-styles";

/** Due date section of the card dialog: a date field, quick picks and the current status. */
export function CardDueDate({ cardId, now }: { cardId: string; now: Date }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const isDone = useBoardData((d) => (card ? Boolean(d.columns[card.columnId]?.isDone) : false));
  const { updateCard } = useBoardActions();

  if (!card) return null;
  const inputId = `card-${cardId}-due`;
  const setDueDate = (dueDate: string | null) => updateCard(cardId, { dueDate });

  return (
    <section className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-semibold">
        Due date
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          type="date"
          value={card.dueDate ?? ""}
          onChange={(e) => {
            const { value } = e.target;
            // Browsers report "" while a typed date is incomplete or cleared.
            if (!value) setDueDate(null);
            else if (isValidDueDate(value)) setDueDate(value);
          }}
          className="h-8 w-auto"
        />

        {card.dueDate && (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                dueChipClass[getDueStatus(card.dueDate, now, isDone)],
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {getDueLabel(card.dueDate, now, isDone)}
            </span>
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setDueDate(null)}
            >
              <X /> Clear
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick due dates">
        {getDuePresets(now).map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="xs"
            aria-pressed={card.dueDate === preset.dueDate}
            onClick={() => setDueDate(preset.dueDate)}
            className="aria-pressed:border-primary aria-pressed:bg-primary/10"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {isDone && card.dueDate && (
        <p className="text-muted-foreground text-xs">
          This card is in a done column, so it won’t show due warnings.
        </p>
      )}
    </section>
  );
}
