"use client";

import { useEffect } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { clearPendingChunk, findPendingCard, readPendingChunk } from "@/lib/ai/pending-chunk";
import { findGuestBoardsToImport } from "@/lib/storage/guest-import";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import type { OpenChunkOptions } from "./chunk-dialog-context";

/**
 * After a guest ran out of free tries and logged in, opens "Chunk it" on the same card and
 * runs it again. Waits until the card is on the board (e.g. after the guest boards import).
 */
export function ResumePendingChunk({
  openChunk,
}: {
  openChunk: (cardId: string, options?: OpenChunkOptions) => void;
}) {
  const auth = useAuthUser();
  const data = useBoardData((d) => d);
  const { setActiveBoard } = useBoardActions();
  const userId = auth.status === "signed-in" ? auth.user.id : null;

  useEffect(() => {
    if (!userId) return;
    const pending = readPendingChunk();
    if (!pending || pending.path !== window.location.pathname) return;
    // While guest boards wait to be imported, a same-titled card isn't the right one yet.
    const cardId = findPendingCard(data, pending, findGuestBoardsToImport(userId) === null);
    if (!cardId) return;

    clearPendingChunk();
    const boardId = data.cards[cardId].boardId;
    if (boardId !== data.activeBoardId) setActiveBoard(boardId);
    openChunk(cardId, { detail: pending.detail, autoRun: true });
  }, [userId, data, openChunk, setActiveBoard]);

  return null;
}
