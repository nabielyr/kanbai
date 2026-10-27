"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MAX_LABEL_NAME_LENGTH, MAX_LABELS_PER_BOARD } from "@/lib/domain/board-ops";
import { LABEL_COLORS, type Label, type LabelColor } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoardData, useBoardStoreApi } from "@/store/board-store-provider";
import { labelColorClass, labelSwatchClass } from "./card-styles";

const NO_LABELS: Label[] = [];

const colorName = (color: LabelColor) => color[0].toUpperCase() + color.slice(1);

/** The first palette color no label uses yet, so new labels look distinct by default. */
function suggestColor(labels: Label[]): LabelColor {
  const used = new Set(labels.map((l) => l.color));
  return (
    LABEL_COLORS.find((c) => !used.has(c)) ?? LABEL_COLORS[labels.length % LABEL_COLORS.length]
  );
}

/** Label section of the card dialog: toggle labels on the card, or manage the board's labels. */
export function CardLabels({ cardId }: { cardId: string }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const labels = useBoardData((d) => (card ? d.boards[card.boardId]?.labels : undefined));
  const { updateCard } = useBoardActions();
  const [managing, setManaging] = useState(false);

  if (!card) return null;
  const boardLabels = labels ?? NO_LABELS;

  function toggle(labelId: string) {
    const selected = card!.labelIds.includes(labelId);
    updateCard(cardId, {
      labelIds: selected
        ? card!.labelIds.filter((id) => id !== labelId)
        : [...card!.labelIds, labelId],
    });
  }

  return (
    <section className="space-y-2" aria-labelledby={`card-${cardId}-labels`}>
      <div className="flex items-center justify-between gap-2">
        <h3
          id={`card-${cardId}-labels`}
          className="font-sans text-sm font-semibold tracking-normal"
        >
          Labels
        </h3>
        <Button variant="ghost" size="xs" onClick={() => setManaging((m) => !m)}>
          {managing ? (
            <>
              <Check /> Done editing
            </>
          ) : (
            <>
              <Pencil /> Edit labels
            </>
          )}
        </Button>
      </div>

      {managing ? (
        <LabelManager
          boardId={card.boardId}
          labels={boardLabels}
          onCreated={(labelId) => updateCard(cardId, { labelIds: [...card.labelIds, labelId] })}
        />
      ) : boardLabels.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This board has no labels yet. Use “Edit labels” to create one.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {boardLabels.map((label) => {
            const selected = card.labelIds.includes(label.id);
            return (
              <li key={label.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(label.id)}
                  className={cn(
                    "focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition outline-none focus-visible:ring-[3px]",
                    labelColorClass[label.color],
                    selected ? "border-current" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  {selected && <Check className="size-3" aria-hidden="true" />}
                  {label.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LabelManager({
  boardId,
  labels,
  onCreated,
}: {
  boardId: string;
  labels: Label[];
  onCreated: (labelId: string) => void;
}) {
  const { addLabel, deleteLabel } = useBoardActions();
  const storeApi = useBoardStoreApi();
  const [pendingDelete, setPendingDelete] = useState<{ label: Label; uses: number } | null>(null);

  function requestDelete(label: Label) {
    const uses = Object.values(storeApi.getState().data.cards).filter(
      (c) => c.boardId === boardId && c.labelIds.includes(label.id),
    ).length;
    if (uses === 0) deleteLabel(boardId, label.id);
    else setPendingDelete({ label, uses });
  }

  return (
    <div className="space-y-3">
      {labels.length > 0 && (
        <ul className="space-y-1.5" aria-label="Board labels">
          {labels.map((label) => (
            <LabelRow
              key={label.id}
              boardId={boardId}
              label={label}
              onDelete={() => requestDelete(label)}
            />
          ))}
        </ul>
      )}

      <NewLabelForm
        labels={labels}
        onSubmit={(name, color) => {
          const id = addLabel(boardId, name, color);
          if (id) onCreated(id);
          return id !== null;
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete label “{pendingDelete?.label.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from {pendingDelete?.uses}{" "}
              {pendingDelete?.uses === 1 ? "card" : "cards"}. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDelete && deleteLabel(boardId, pendingDelete.label.id)}
            >
              Delete label
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LabelRow({
  boardId,
  label,
  onDelete,
}: {
  boardId: string;
  label: Label;
  onDelete: () => void;
}) {
  const { updateLabel } = useBoardActions();
  const [name, setName] = useState(label.name);
  const [error, setError] = useState<string | null>(null);
  const errorId = `label-${label.id}-error`;

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === label.name) {
      setName(label.name); // a label always keeps a name
      setError(null);
    } else if (updateLabel(boardId, label.id, { name })) {
      setName(trimmed);
      setError(null);
    } else {
      setError("Another label already has this name.");
    }
  }

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-1.5">
        <ColorPicker
          value={label.color}
          onChange={(color) => updateLabel(boardId, label.id, { color })}
          aria-label={`Color of label “${label.name}”`}
        />
        <Input
          aria-label={`Name of label “${label.name}”`}
          value={name}
          maxLength={MAX_LABEL_NAME_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commitName();
            }
          }}
          className="h-8"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete label “${label.name}”`}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-destructive pl-10 text-xs">
          {error}
        </p>
      )}
    </li>
  );
}

function NewLabelForm({
  labels,
  onSubmit,
}: {
  labels: Label[];
  /** Returns false when the label was rejected. */
  onSubmit: (name: string, color: LabelColor) => boolean;
}) {
  const [name, setName] = useState("");
  const [chosenColor, setChosenColor] = useState<LabelColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const color = chosenColor ?? suggestColor(labels);
  const full = labels.length >= MAX_LABELS_PER_BOARD;

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (onSubmit(name, color)) {
          setName("");
          setChosenColor(null);
          setError(null);
        } else {
          setError("A label with this name already exists.");
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <ColorPicker value={color} onChange={setChosenColor} aria-label="Color of new label" />
        <Input
          aria-label="New label name"
          placeholder={full ? "Label limit reached" : "New label…"}
          value={name}
          disabled={full}
          maxLength={MAX_LABEL_NAME_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-label-error" : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          className="h-8"
        />
        <Button type="submit" size="sm" disabled={full || !name.trim()}>
          <Plus /> Add
        </Button>
      </div>
      {error && (
        <p id="new-label-error" className="text-destructive pl-10 text-xs">
          {error}
        </p>
      )}
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
  "aria-label": string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`${ariaLabel}: ${colorName(value)}`}
        >
          <span className={cn("size-4 rounded-full border", labelSwatchClass[value])} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as LabelColor)}
        >
          {LABEL_COLORS.map((color) => (
            <DropdownMenuRadioItem key={color} value={color}>
              <span className={cn("size-4 rounded-full border", labelSwatchClass[color])} />
              {colorName(color)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
