"use client";

import { useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { CardMenu } from "./card-menu";
import { CardTile } from "./card-tile";
import { useDeleteCard } from "./use-delete-card";

/** A card connected to the store: renders the tile plus its menu and inline title editing. */
export function BoardCard({ cardId, now }: { cardId: string; now: Date }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const labels = useBoardData((d) => (card ? d.boards[card.boardId]?.labels : undefined));
  const isDone = useBoardData((d) => (card ? Boolean(d.columns[card.columnId]?.isDone) : false));
  const { updateCard } = useBoardActions();
  const deleteCard = useDeleteCard();
  const [editing, setEditing] = useState(false);

  if (!card) return null;

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
            onDelete={() => deleteCard(cardId)}
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
