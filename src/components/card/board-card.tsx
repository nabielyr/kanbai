"use client";

import { useState } from "react";
import { useColumnCardIds } from "@/components/board/dnd/board-dnd";
import { useChunkDialog } from "@/components/chunk/chunk-dialog-context";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { CardMenu } from "./card-menu";
import { CardTile } from "./card-tile";
import { useDeleteCard } from "./use-delete-card";
import { useMoveCard } from "./use-move-card";

const EMPTY: string[] = [];

/** A card connected to the store: renders the tile plus its menu and inline title editing. */
export function BoardCard({ cardId, now }: { cardId: string; now: Date }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const labels = useBoardData((d) => (card ? d.boards[card.boardId]?.labels : undefined));
  const isDone = useBoardData((d) => (card ? Boolean(d.columns[card.columnId]?.isDone) : false));
  const { updateCard } = useBoardActions();
  const deleteCard = useDeleteCard();
  const { openChunk } = useChunkDialog();
  const move = useMoveCard();
  const columnIds = useBoardData((d) => (card ? d.boards[card.boardId]?.columnIds : undefined));
  const columns = useBoardData((d) => d.columns);
  const visibleIds = useColumnCardIds(card?.columnId ?? "");
  const [editing, setEditing] = useState(false);

  if (!card) return null;
  const index = visibleIds.indexOf(cardId);
  const moveTargets = (columnIds ?? EMPTY)
    .filter((id) => id !== card.columnId && columns[id])
    .map((id) => ({ id, title: columns[id].title }));

  return (
    <CardTile
      card={card}
      labels={labels ?? []}
      isDone={isDone}
      now={now}
      actions={
        editing ? undefined : (
          <CardMenu
            cardId={cardId}
            cardTitle={card.title}
            moveTargets={moveTargets}
            onEditTitle={() => setEditing(true)}
            onChunk={() => openChunk(cardId)}
            onMoveToColumn={(columnId) => move.toColumn(cardId, columnId)}
            onMoveUp={index > 0 ? () => move.step(cardId, visibleIds, -1) : undefined}
            onMoveDown={
              index !== -1 && index < visibleIds.length - 1
                ? () => move.step(cardId, visibleIds, 1)
                : undefined
            }
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
