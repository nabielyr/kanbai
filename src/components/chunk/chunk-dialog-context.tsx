"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DetailLevel } from "@/lib/ai/schemas";
import { ChunkDialog } from "./chunk-dialog";
import { ResumePendingChunk } from "./resume-pending-chunk";

export interface OpenChunkOptions {
  detail?: DetailLevel;
  /** Start generating right away (resuming a chunk asked for before logging in). */
  autoRun?: boolean;
}

interface ChunkDialogContextValue {
  openChunk: (cardId: string, options?: OpenChunkOptions) => void;
}

const ChunkDialogContext = createContext<ChunkDialogContextValue | null>(null);

/** One "Chunk it" dialog per board; a card tile or the card dialog can open it. */
export function ChunkDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<{ cardId: string; options: OpenChunkOptions } | null>(
    null,
  );
  const openChunk = useCallback(
    (cardId: string, options: OpenChunkOptions = {}) => setRequest({ cardId, options }),
    [],
  );
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ openChunk }), [openChunk]);

  return (
    <ChunkDialogContext.Provider value={value}>
      {children}
      <ChunkDialog cardId={request?.cardId ?? null} options={request?.options} onClose={close} />
      <ResumePendingChunk openChunk={openChunk} />
    </ChunkDialogContext.Provider>
  );
}

export function useChunkDialog(): ChunkDialogContextValue {
  const context = useContext(ChunkDialogContext);
  if (!context) throw new Error("useChunkDialog must be used inside <ChunkDialogProvider>");
  return context;
}
