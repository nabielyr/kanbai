"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "@/lib/domain/board-ops";
import { PRIORITIES, type Priority } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoardData, useBoardStoreApi } from "@/store/board-store-provider";
import { CardDueDate } from "./card-due-date";
import { CardLabels } from "./card-labels";
import { priorityIcon, priorityMeta } from "./card-styles";
import { useDeleteCard } from "./use-delete-card";

interface CardDialogProps {
  cardId: string | null;
  /** Clock for due-date status, shared with the board. */
  now: Date;
  onClose: () => void;
}

export function CardDialog({ cardId, now, onClose }: CardDialogProps) {
  // Keep showing the last card while the close animation runs.
  const [shownCardId, setShownCardId] = useState(cardId);
  if (cardId && cardId !== shownCardId) setShownCardId(cardId);

  const exists = useBoardData((d) => (shownCardId ? Boolean(d.cards[shownCardId]) : false));
  const commitRef = useRef<(() => void) | null>(null);
  const open = cardId !== null && exists;

  // The card was deleted elsewhere (e.g. another tab) while open.
  useEffect(() => {
    if (cardId && !exists) onClose();
  }, [cardId, exists, onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        commitRef.current?.();
        onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {shownCardId && exists && (
          <CardDialogBody
            key={shownCardId}
            cardId={shownCardId}
            now={now}
            commitRef={commitRef}
            onRequestClose={() => {
              commitRef.current?.();
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardDialogBody({
  cardId,
  now,
  commitRef,
  onRequestClose,
}: {
  cardId: string;
  now: Date;
  commitRef: React.RefObject<(() => void) | null>;
  onRequestClose: () => void;
}) {
  const card = useBoardData((d) => d.cards[cardId]);
  const columnTitle = useBoardData((d) => (card ? d.columns[card.columnId]?.title : undefined));
  const { updateCard } = useBoardActions();
  const storeApi = useBoardStoreApi();
  const deleteCard = useDeleteCard();

  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  // Latest drafts for committing from event handlers and cleanup.
  const drafts = useRef({ title, description });
  useLayoutEffect(() => {
    drafts.current = { title, description };
  }, [title, description]);

  useEffect(() => {
    const commit = () => {
      const saved = storeApi.getState().data.cards[cardId];
      if (!saved) return;
      const { title, description } = drafts.current;
      const patch: { title?: string; description?: string } = {};
      if (title.trim() && title.trim() !== saved.title) patch.title = title;
      if (description !== saved.description) patch.description = description;
      if (Object.keys(patch).length > 0) updateCard(cardId, patch);
    };
    commitRef.current = commit;
    return () => {
      commit();
      commitRef.current = null;
    };
  }, [cardId, updateCard, commitRef, storeApi]);

  if (!card) return null;

  function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(card!.title); // a card always keeps a title
      return;
    }
    if (trimmed !== card!.title) updateCard(cardId, { title: trimmed });
  }

  return (
    <>
      <div className="space-y-1 pr-8">
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <textarea
          aria-label="Card title"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          rows={1}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={commitTitle}
          className="font-heading hover:bg-muted focus-visible:ring-ring/50 field-sizing-content w-full resize-none rounded-lg px-1 py-0.5 text-xl font-bold outline-none focus-visible:ring-[3px] sm:text-2xl"
        />
        <DialogDescription className="px-1">
          in <span className="text-foreground font-medium">{columnTitle}</span>
        </DialogDescription>
      </div>

      <PriorityPicker
        value={card.priority}
        onChange={(priority) => updateCard(cardId, { priority })}
      />

      <CardLabels cardId={cardId} />

      <CardDueDate cardId={cardId} now={now} />

      <div className="space-y-2">
        <label htmlFor={`card-${cardId}-description`} className="text-sm font-semibold">
          Description
        </label>
        <Textarea
          id={`card-${cardId}-description`}
          value={description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Add more detail — the AI uses this when you “Chunk it”."
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== card.description) updateCard(cardId, { description });
          }}
          className="min-h-28"
        />
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          variant="destructive"
          onClick={() => {
            onRequestClose();
            deleteCard(cardId);
          }}
        >
          <Trash2 /> Delete card
        </Button>
        <Button variant="outline" onClick={onRequestClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Priority</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRIORITIES.map((priority) => {
          const Icon = priorityIcon[priority];
          const meta = priorityMeta[priority];
          return (
            <label key={priority} className="relative">
              <input
                type="radio"
                name="priority"
                value={priority}
                checked={value === priority}
                onChange={() => onChange(priority)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-muted peer-focus-visible:ring-ring/50 peer-focus-visible:ring-[3px]",
                  "peer-checked:border-primary peer-checked:bg-primary/10",
                )}
              >
                <Icon className={cn("size-4", meta.className)} aria-hidden="true" />
                {meta.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
