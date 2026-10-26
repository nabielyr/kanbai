"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";
import { BoardCard } from "./board-card";
import { useCardDialog } from "./card-dialog-context";

const INTERACTIVE = "button, a, input, textarea, select, [role='menuitem']";

/**
 * A card that can be dragged within and between columns (mouse, touch long-press, Space key),
 * and opens its detail dialog on click or Enter.
 */
export function SortableCard({ cardId, now }: { cardId: string; now: Date }) {
  const title = useBoardData((d) => d.cards[cardId]?.title ?? "");
  const { openCard } = useCardDialog();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardId,
    data: { type: "card" },
  });

  // Ignore the click that can follow a drop.
  const justDragged = useRef(false);
  useEffect(() => {
    if (isDragging) {
      justDragged.current = true;
      return;
    }
    const timer = setTimeout(() => (justDragged.current = false), 100);
    return () => clearTimeout(timer);
  }, [isDragging]);

  function fromInteractiveChild(target: EventTarget, currentTarget: EventTarget) {
    const interactive = (target as HTMLElement).closest?.(INTERACTIVE);
    return interactive !== null && interactive !== undefined && interactive !== currentTarget;
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (justDragged.current || fromInteractiveChild(e.target, e.currentTarget)) return;
        openCard(cardId);
      }}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && e.target === e.currentTarget && !e.defaultPrevented) {
          e.preventDefault();
          openCard(cardId);
        }
      }}
      role="button"
      aria-roledescription="draggable card"
      aria-label={title}
      aria-haspopup="dialog"
      className={cn(
        "focus-visible:ring-ring/50 cursor-pointer touch-manipulation rounded-lg outline-none select-none focus-visible:ring-[3px] active:cursor-grabbing [&_input]:select-text",
        // The original stays in place as a faded placeholder while its overlay is dragged.
        isDragging && "opacity-40",
      )}
    >
      <BoardCard cardId={cardId} now={now} />
    </li>
  );
}
