"use client";

import { CircleCheckBig } from "lucide-react";
import { AddCard } from "@/components/card/add-card";
import { BoardCard } from "@/components/card/board-card";
import { useBoardData } from "@/store/board-store-provider";

export function Column({ columnId, now }: { columnId: string; now: Date }) {
  const column = useBoardData((d) => d.columns[columnId]);
  if (!column) return null;

  const headingId = `column-${column.id}-title`;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-column flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl sm:w-72"
    >
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        {column.isDone && (
          <CircleCheckBig className="text-label-mint-foreground size-4" aria-hidden="true" />
        )}
        <h2 id={headingId} className="font-heading text-sm font-semibold">
          {column.title}
        </h2>
        <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
          {column.cardIds.length}
        </span>
      </header>

      <ol className="flex min-h-4 flex-col gap-2 overflow-y-auto px-2 pb-1">
        {column.cardIds.map((cardId) => (
          <li key={cardId}>
            <BoardCard cardId={cardId} now={now} />
          </li>
        ))}
      </ol>

      <div className="px-2 pt-1 pb-2">
        <AddCard columnId={column.id} columnTitle={column.title} />
      </div>
    </section>
  );
}
