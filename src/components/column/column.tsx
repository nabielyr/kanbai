"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useColumnCardIds } from "@/components/board/dnd/board-dnd";
import { AddCard } from "@/components/card/add-card";
import { SortableCard } from "@/components/card/sortable-card";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";
import { ColumnHeader } from "./column-header";

export function Column({ columnId, now }: { columnId: string; now: Date }) {
  const column = useBoardData((d) => d.columns[columnId]);
  const cardIds = useColumnCardIds(columnId);
  // Sortable for reordering columns (via the grip), and a drop target for cards at the same time,
  // so empty columns accept cards too.
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({ id: columnId, data: { type: "column" } });
  if (!column) return null;

  const headingId = `column-${column.id}-title`;
  const cardHovering = isOver && active?.data.current?.type === "card";

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-labelledby={headingId}
      className={cn(
        "bg-column flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl transition-shadow sm:w-72",
        cardHovering && "ring-primary/40 ring-2",
        isDragging && "opacity-40",
      )}
    >
      <ColumnHeader
        column={column}
        headingId={headingId}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-roledescription="draggable column"
            aria-label={`Move column “${column.title}”`}
            className="text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:ring-ring/50 -ml-0.5 shrink-0 cursor-grab touch-manipulation rounded-md p-0.5 outline-none focus-visible:ring-[3px]"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        }
      />

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
