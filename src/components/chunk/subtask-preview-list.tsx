"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { SortableList, SortableRow } from "@/components/common/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_ESTIMATE_MINUTES, MAX_SUBTASK_TITLE, MIN_ESTIMATE_MINUTES } from "@/lib/ai/schemas";
import {
  addDraftItem,
  formatMinutes,
  getDraftTotalMinutes,
  MAX_DRAFT_ITEMS,
  moveDraftItem,
  removeDraftItem,
  updateDraftItem,
  type DraftSubtask,
} from "@/lib/ai/subtask-draft";
import { createId } from "@/lib/domain/ids";

/** The editable list of suggested subtasks. Edits stay in the dialog until accepted. */
export function SubtaskPreviewList({
  items,
  onChange,
}: {
  items: DraftSubtask[];
  onChange: (items: DraftSubtask[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const full = items.length >= MAX_DRAFT_ITEMS;
  const total = getDraftTotalMinutes(items);

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <SortableList
          ids={items.map((i) => i.id)}
          onMove={(id, toIndex) => onChange(moveDraftItem(items, id, toIndex))}
          getLabel={(id) => items.find((i) => i.id === id)?.title ?? "subtask"}
          aria-label="Suggested subtasks"
          className="space-y-1"
        >
          {items.map((item, index) => (
            <PreviewRow
              key={item.id}
              item={item}
              index={index}
              onUpdate={(patch) => {
                const next = updateDraftItem(items, item.id, patch);
                onChange(next);
                return next.find((i) => i.id === item.id) ?? item;
              }}
              onRemove={() => onChange(removeDraftItem(items, item.id))}
            />
          ))}
        </SortableList>
      ) : (
        <p className="text-muted-foreground text-sm">
          No subtasks left. Add one below or regenerate.
        </p>
      )}

      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const next = addDraftItem(items, { id: createId(), title: newTitle });
          if (next !== items) {
            onChange(next);
            setNewTitle("");
          }
        }}
      >
        <Input
          aria-label="New subtask"
          placeholder={full ? "That's plenty of steps" : "Add a step…"}
          value={newTitle}
          disabled={full}
          maxLength={MAX_SUBTASK_TITLE}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="outline" disabled={full || !newTitle.trim()}>
          <Plus /> Add
        </Button>
      </form>

      {items.length > 0 && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {items.length} {items.length === 1 ? "step" : "steps"} · about{" "}
          <span className="text-foreground font-medium">{formatMinutes(total)}</span> in total
        </p>
      )}
    </div>
  );
}

function PreviewRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: DraftSubtask;
  index: number;
  /** Applies a patch and returns the item as saved (titles cleaned, estimates clamped). */
  onUpdate: (patch: Partial<Pick<DraftSubtask, "title" | "estimateMinutes">>) => DraftSubtask;
  onRemove: () => void;
}) {
  // Local text while typing; committed (and cleaned/clamped) on blur or Enter.
  const [title, setTitle] = useState(item.title);
  const [minutes, setMinutes] = useState(String(item.estimateMinutes));

  const commitTitle = () => setTitle(onUpdate({ title }).title);
  const commitMinutes = () =>
    setMinutes(String(onUpdate({ estimateMinutes: Number.parseFloat(minutes) }).estimateMinutes));
  const commitOnEnter = (commit: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit();
    }
  };

  return (
    <SortableRow
      id={item.id}
      index={index}
      gripLabel={`Reorder “${item.title}”`}
      className="hover:bg-muted/60"
    >
      <Input
        aria-label={`Step ${index + 1}`}
        value={title}
        maxLength={MAX_SUBTASK_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={commitOnEnter(commitTitle)}
        className="h-8 min-w-0 flex-1"
      />
      <Input
        type="number"
        inputMode="numeric"
        aria-label={`Minutes for “${item.title}”`}
        value={minutes}
        min={MIN_ESTIMATE_MINUTES}
        max={MAX_ESTIMATE_MINUTES}
        step={5}
        onChange={(e) => setMinutes(e.target.value)}
        onBlur={commitMinutes}
        onKeyDown={commitOnEnter(commitMinutes)}
        className="h-8 w-18 shrink-0 px-2 text-right"
      />
      <span className="text-muted-foreground shrink-0 text-xs" aria-hidden="true">
        min
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-destructive shrink-0"
        aria-label={`Remove “${item.title}”`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </SortableRow>
  );
}
