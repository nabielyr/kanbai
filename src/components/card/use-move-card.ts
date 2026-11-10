"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useBoardActions, useBoardStoreApi } from "@/store/board-store-provider";

/**
 * Moves a card without dragging (the "Move to" items in the card menu). `visibleIds` is the
 * column as shown, so with a filter on, "up" and "down" step past the cards you can see.
 */
export function useMoveCard() {
  const { moveCard } = useBoardActions();
  const storeApi = useBoardStoreApi();

  const toColumn = useCallback(
    (cardId: string, toColumnId: string) => {
      const data = storeApi.getState().data;
      const card = data.cards[cardId];
      const from = card && data.columns[card.columnId];
      const to = data.columns[toColumnId];
      if (!card || !from || !to || from.id === to.id) return;

      const nextId = from.cardIds[from.cardIds.indexOf(cardId) + 1] ?? null;
      moveCard(cardId, to.id, null);
      toast(`Moved “${card.title}” to ${to.title}`, {
        action: { label: "Undo", onClick: () => moveCard(cardId, from.id, nextId) },
      });
    },
    [moveCard, storeApi],
  );

  const step = useCallback(
    (cardId: string, visibleIds: string[], direction: -1 | 1) => {
      const data = storeApi.getState().data;
      const column = data.cards[cardId] && data.columns[data.cards[cardId].columnId];
      const index = visibleIds.indexOf(cardId);
      const neighbour = visibleIds[index + direction];
      if (!column || index === -1 || !neighbour) return;

      if (direction === -1) {
        moveCard(cardId, column.id, neighbour);
      } else {
        // Land right after the next card, wherever hidden cards sit.
        const after = column.cardIds[column.cardIds.indexOf(neighbour) + 1] ?? null;
        moveCard(cardId, column.id, after);
      }
    },
    [moveCard, storeApi],
  );

  return { toColumn, step };
}
