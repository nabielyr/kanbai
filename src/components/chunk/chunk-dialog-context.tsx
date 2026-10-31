"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ChunkDialog } from "./chunk-dialog";

interface ChunkDialogContextValue {
  openChunk: (cardId: string) => void;
}

const ChunkDialogContext = createContext<ChunkDialogContextValue | null>(null);

/** One "Chunk it" dialog per board; a card tile or the card dialog can open it. */
export function ChunkDialogProvider({ children }: { children: React.ReactNode }) {
  const [cardId, setCardId] = useState<string | null>(null);
  const openChunk = useCallback((id: string) => setCardId(id), []);
  const close = useCallback(() => setCardId(null), []);
  const value = useMemo(() => ({ openChunk }), [openChunk]);

  return (
    <ChunkDialogContext.Provider value={value}>
      {children}
      <ChunkDialog cardId={cardId} onClose={close} />
    </ChunkDialogContext.Provider>
  );
}

export function useChunkDialog(): ChunkDialogContextValue {
  const context = useContext(ChunkDialogContext);
  if (!context) throw new Error("useChunkDialog must be used inside <ChunkDialogProvider>");
  return context;
}
