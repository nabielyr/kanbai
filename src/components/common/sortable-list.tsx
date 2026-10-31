"use client";

import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// A vertical list whose rows can be reordered by dragging a grip (mouse, or long-press on
// touch) or by pressing the arrow keys on a focused grip. Used inside dialogs, where the
// board's own drag-and-drop context doesn't reach.

const REORDER_HINT = "Drag to reorder, or press the up and down arrow keys.";

interface SortableListContextValue {
  move: (id: string, toIndex: number) => void;
}

const SortableListContext = createContext<SortableListContextValue | null>(null);

export function SortableList({
  ids,
  onMove,
  getLabel,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  ids: string[];
  onMove: (id: string, toIndex: number) => void;
  /** Name of a row, used in screen reader announcements. */
  getLabel: (id: string) => string;
  "aria-label": string;
  className?: string;
  children: React.ReactNode;
}) {
  const [announcement, setAnnouncement] = useState("");
  // Long-press on touch so scrolling the dialog never starts a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function move(id: string, toIndex: number) {
    if (toIndex < 0 || toIndex >= ids.length || ids.indexOf(id) === toIndex) return;
    onMove(id, toIndex);
    setAnnouncement(`Moved “${getLabel(id)}” to position ${toIndex + 1} of ${ids.length}.`);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(String(active.id), ids.indexOf(String(over.id)));
  }

  return (
    <SortableListContext.Provider value={{ move }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ screenReaderInstructions: { draggable: REORDER_HINT } }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={className} aria-label={ariaLabel}>
            {children}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </SortableListContext.Provider>
  );
}

export function SortableRow({
  id,
  index,
  gripLabel,
  className,
  children,
}: {
  id: string;
  index: number;
  /** Accessible name of the grip, e.g. `Reorder “Write tests”`. */
  gripLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(SortableListContext);
  if (!context) throw new Error("SortableRow must be used inside <SortableList>");
  const grip = useRef<HTMLButtonElement | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-1 py-0.5",
        isDragging && "bg-card shadow-lift relative z-10",
        className,
      )}
    >
      <button
        type="button"
        ref={(node) => {
          setActivatorNodeRef(node);
          grip.current = node;
        }}
        {...attributes}
        {...listeners}
        aria-roledescription="sortable item"
        aria-label={gripLabel}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          context.move(id, index + (e.key === "ArrowUp" ? -1 : 1));
          // React moves the focused node when reordering; keep focus on this grip.
          requestAnimationFrame(() => grip.current?.focus());
        }}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 shrink-0 cursor-grab touch-none rounded p-0.5 outline-none focus-visible:ring-[3px] active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      {children}
    </li>
  );
}
