"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CardDialog } from "./card-dialog";

interface CardDialogContextValue {
  openCardId: string | null;
  openCard: (cardId: string) => void;
  closeCard: () => void;
}

const CardDialogContext = createContext<CardDialogContextValue | null>(null);

/** One card-detail dialog per board; any card can ask to open it. */
export function CardDialogProvider({ children }: { children: React.ReactNode }) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const openCard = useCallback((cardId: string) => setOpenCardId(cardId), []);
  const closeCard = useCallback(() => setOpenCardId(null), []);
  const value = useMemo(
    () => ({ openCardId, openCard, closeCard }),
    [openCardId, openCard, closeCard],
  );

  return (
    <CardDialogContext.Provider value={value}>
      {children}
      <CardDialog cardId={openCardId} onClose={closeCard} />
    </CardDialogContext.Provider>
  );
}

export function useCardDialog(): CardDialogContextValue {
  const context = useContext(CardDialogContext);
  if (!context) throw new Error("useCardDialog must be used inside <CardDialogProvider>");
  return context;
}
