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
import { GripVertical, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getChecklistProgress,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TITLE_LENGTH,
} from "@/lib/domain/checklist";
import type { ChecklistItem } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";

const REORDER_HINT = "Drag to reorder, or press the up and down arrow keys.";

/** Checklist section of the card dialog: progress, items (toggle/edit/delete/reorder) and add. */
export function CardChecklist({ cardId }: { cardId: string }) {
  const items = useBoardData((d) => d.cards[cardId]?.checklist);
  const { addChecklistItem, moveChecklistItem } = useBoardActions();
  const [newTitle, setNewTitle] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const grips = useRef(new Map<string, HTMLButtonElement>());
  // Long-press on touch so scrolling the dialog never starts a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  if (!items) return null;
  const progress = getChecklistProgress(items);
  const full = items.length >= MAX_CHECKLIST_ITEMS;
  const headingId = `card-${cardId}-checklist`;

  function move(item: ChecklistItem, toIndex: number) {
    if (toIndex < 0 || toIndex >= items!.length) return;
    moveChecklistItem(cardId, item.id, toIndex);
    setAnnouncement(`Moved “${item.title}” to position ${toIndex + 1} of ${items!.length}.`);
    // React moves the focused node when reordering; make sure focus stays on its grip.
    requestAnimationFrame(() => grips.current.get(item.id)?.focus());
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const item = items!.find((i) => i.id === active.id);
    const toIndex = items!.findIndex((i) => i.id === over.id);
    if (item && toIndex !== -1) move(item, toIndex);
  }

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="font-sans text-sm font-semibold tracking-normal">
          Checklist
        </h3>
        {progress.total > 0 && (
          <span className="text-muted-foreground text-xs font-medium">
            {progress.done}/{progress.total} done
          </span>
        )}
      </div>

      {progress.total > 0 && (
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
              progress.ratio === 1 ? "bg-label-mint-foreground" : "bg-primary",
            )}
            style={{ width: `${progress.ratio * 100}%` }}
          />
        </div>
      )}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: REORDER_HINT } }}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5" aria-label="Checklist items">
              {items.map((item, index) => (
                <ChecklistRow
                  key={item.id}
                  cardId={cardId}
                  item={item}
                  registerGrip={(node) => {
                    if (node) grips.current.set(item.id, node);
                    else grips.current.delete(item.id);
                  }}
                  onMoveBy={(delta) => move(item, index + delta)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (addChecklistItem(cardId, newTitle)) setNewTitle("");
        }}
      >
        <Input
          aria-label="New checklist item"
          placeholder={full ? "Checklist is full" : "Add an item…"}
          value={newTitle}
          disabled={full}
          maxLength={MAX_CHECKLIST_TITLE_LENGTH}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="outline" disabled={full || !newTitle.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </section>
  );
}

function ChecklistRow({
  cardId,
  item,
  registerGrip,
  onMoveBy,
}: {
  cardId: string;
  item: ChecklistItem;
  registerGrip: (node: HTMLButtonElement | null) => void;
  onMoveBy: (delta: number) => void;
}) {
  const { toggleChecklistItem, renameChecklistItem, deleteChecklistItem } = useBoardActions();
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const titleId = `checklist-${item.id}-title`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/item hover:bg-muted/60 flex items-center gap-1.5 rounded-lg px-1 py-0.5",
        isDragging && "bg-card shadow-lift relative z-10",
      )}
    >
      <button
        type="button"
        ref={(node) => {
          setActivatorNodeRef(node);
          registerGrip(node);
        }}
        {...attributes}
        {...listeners}
        aria-roledescription="sortable item"
        aria-label={`Reorder “${item.title}”`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMoveBy(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-grab touch-none rounded p-0.5 outline-none focus-visible:ring-[3px] active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <input
        type="checkbox"
        checked={item.done}
        onChange={() => toggleChecklistItem(cardId, item.id)}
        aria-labelledby={titleId}
        className="accent-primary size-4 shrink-0 cursor-pointer"
      />

      {editing ? (
        <InlineTextInput
          aria-label="Checklist item"
          initialValue={item.title}
          maxLength={MAX_CHECKLIST_TITLE_LENGTH}
          onSubmit={(title) => {
            renameChecklistItem(cardId, item.id, title);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          className="py-1"
        />
      ) : (
        <button
          type="button"
          id={titleId}
          onClick={() => setEditing(true)}
          title="Click to edit"
          className={cn(
            "focus-visible:ring-ring/50 min-w-0 flex-1 rounded px-1 py-1 text-left text-sm break-words outline-none focus-visible:ring-[3px]",
            item.done && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </button>
      )}

      {!editing && item.estimateMinutes !== undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">~{item.estimateMinutes}m</span>
      )}

      {!editing && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-visible:opacity-100"
          aria-label={`Delete “${item.title}”`}
          onClick={() => deleteChecklistItem(cardId, item.id)}
        >
          <X />
        </Button>
      )}
    </li>
  );
}
