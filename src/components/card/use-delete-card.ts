"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useBoardActions, useBoardStoreApi } from "@/store/board-store-provider";

/** Deletes a card and shows a toast with Undo that puts it back in place. */
export function useDeleteCard() {
  const { deleteCard } = useBoardActions();
  const storeApi = useBoardStoreApi();

  return useCallback(
    (cardId: string) => {
      const title = storeApi.getState().data.cards[cardId]?.title;
      const undo = deleteCard(cardId);
      if (undo) toast(`Deleted “${title}”`, { action: { label: "Undo", onClick: undo } });
    },
    [deleteCard, storeApi],
  );
}
