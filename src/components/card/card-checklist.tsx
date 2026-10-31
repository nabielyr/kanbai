"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { SortableList, SortableRow } from "@/components/common/sortable-list";
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

/** Checklist section of the card dialog: progress, items (toggle/edit/delete/reorder) and add. */
export function CardChecklist({ cardId }: { cardId: string }) {
  const items = useBoardData((d) => d.cards[cardId]?.checklist);
  const { addChecklistItem, moveChecklistItem } = useBoardActions();
  const [newTitle, setNewTitle] = useState("");

  if (!items) return null;
  const progress = getChecklistProgress(items);
  const full = items.length >= MAX_CHECKLIST_ITEMS;
  const headingId = `card-${cardId}-checklist`;

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
        <SortableList
          ids={items.map((i) => i.id)}
          onMove={(itemId, toIndex) => moveChecklistItem(cardId, itemId, toIndex)}
          getLabel={(itemId) => items.find((i) => i.id === itemId)?.title ?? "item"}
          aria-label="Checklist items"
          className="space-y-0.5"
        >
          {items.map((item, index) => (
            <ChecklistRow key={item.id} cardId={cardId} item={item} index={index} />
          ))}
        </SortableList>
      )}

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
  index,
}: {
  cardId: string;
  item: ChecklistItem;
  index: number;
}) {
  const { toggleChecklistItem, renameChecklistItem, deleteChecklistItem } = useBoardActions();
  const [editing, setEditing] = useState(false);
  const titleId = `checklist-${item.id}-title`;

  return (
    <SortableRow
      id={item.id}
      index={index}
      gripLabel={`Reorder “${item.title}”`}
      className="group/item hover:bg-muted/60"
    >
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
    </SortableRow>
  );
}
