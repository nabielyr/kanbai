"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";
import { BoardCard } from "./board-card";

/** A card that can be dragged within and between columns (mouse, touch long-press, keyboard). */
export function SortableCard({ cardId, now }: { cardId: string; now: Date }) {
  const title = useBoardData((d) => d.cards[cardId]?.title ?? "");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardId,
    data: { type: "card" },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable card"
      aria-label={title}
      className={cn(
        "focus-visible:ring-ring/50 cursor-grab touch-manipulation rounded-lg outline-none select-none focus-visible:ring-[3px] [&_input]:select-text",
        // The original stays in place as a faded placeholder while its overlay is dragged.
        isDragging && "opacity-40",
      )}
    >
      <BoardCard cardId={cardId} now={now} />
    </li>
  );
}
