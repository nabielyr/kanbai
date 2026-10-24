"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useColumnCardIds } from "@/components/board/dnd/board-dnd";
import { AddCard } from "@/components/card/add-card";
import { SortableCard } from "@/components/card/sortable-card";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";
import { ColumnHeader } from "./column-header";

export function Column({ columnId, now }: { columnId: string; now: Date }) {
  const column = useBoardData((d) => d.columns[columnId]);
  const cardIds = useColumnCardIds(columnId);
  // The whole column is a drop target, so empty columns accept cards too.
  const { setNodeRef, isOver } = useDroppable({ id: columnId, data: { type: "column" } });
  if (!column) return null;

  const headingId = `column-${column.id}-title`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "bg-column flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl transition-shadow sm:w-72",
        isOver && "ring-primary/40 ring-2",
      )}
    >
      <ColumnHeader column={column} headingId={headingId} />

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <ol className="flex min-h-4 flex-col gap-2 overflow-y-auto px-2 pb-1">
          {cardIds.map((cardId) => (
            <SortableCard key={cardId} cardId={cardId} now={now} />
          ))}
        </ol>
      </SortableContext>

      <div className="px-2 pt-1 pb-2">
        <AddCard columnId={column.id} columnTitle={column.title} />
      </div>
    </section>
  );
}
