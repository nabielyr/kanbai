"use client";

import { AddCard } from "@/components/card/add-card";
import { BoardCard } from "@/components/card/board-card";
import { useBoardData } from "@/store/board-store-provider";
import { ColumnHeader } from "./column-header";

export function Column({ columnId, now }: { columnId: string; now: Date }) {
  const column = useBoardData((d) => d.columns[columnId]);
  if (!column) return null;

  const headingId = `column-${column.id}-title`;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-column flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl sm:w-72"
    >
      <ColumnHeader column={column} headingId={headingId} />

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
