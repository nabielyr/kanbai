"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { CardMenu } from "./card-menu";
import { CardTile } from "./card-tile";

/** A card connected to the store: renders the tile plus its menu and inline title editing. */
export function BoardCard({ cardId, now }: { cardId: string; now: Date }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const labels = useBoardData((d) => (card ? d.boards[card.boardId]?.labels : undefined));
  const isDone = useBoardData((d) => (card ? Boolean(d.columns[card.columnId]?.isDone) : false));
  const { updateCard, deleteCard } = useBoardActions();
  const [editing, setEditing] = useState(false);

  if (!card) return null;

  function handleDelete() {
    const title = card!.title;
    const undo = deleteCard(cardId);
    if (undo) {
      toast(`Deleted “${title}”`, { action: { label: "Undo", onClick: undo } });
    }
  }

  return (
    <CardTile
      card={card}
      labels={labels ?? []}
      isDone={isDone}
      now={now}
      actions={
        editing ? undefined : (
          <CardMenu
            cardTitle={card.title}
            onEditTitle={() => setEditing(true)}
            onDelete={handleDelete}
          />
        )
      }
      titleSlot={
        editing ? (
          <InlineTextInput
            aria-label="Card title"
            initialValue={card.title}
            onSubmit={(title) => {
              updateCard(cardId, { title });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : undefined
      }
    />
  );
}
