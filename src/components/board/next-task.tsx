"use client";

import { Compass } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useCardDialog } from "@/components/card/card-dialog-context";
import { Button } from "@/components/ui/button";
import { pickNextTask } from "@/lib/domain/next-task";
import { useBoardStoreApi } from "@/store/board-store-provider";
import { useFilteredBoard } from "./board-filters";

/** How long the suggested card stays highlighted. */
const HIGHLIGHT_MS = 8000;

interface NextTaskValue {
  highlightedCardId: string | null;
  suggest: () => void;
}

const NextTaskContext = createContext<NextTaskValue | null>(null);

/** "What should I do next?" for one board: picks a card, highlights it and says why. */
export function NextTaskProvider({
  boardId,
  now,
  children,
}: {
  boardId: string;
  now: Date;
  children: React.ReactNode;
}) {
  const storeApi = useBoardStoreApi();
  const filtered = useFilteredBoard();
  const { openCard } = useCardDialog();
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const suggest = useCallback(() => {
    const state = storeApi.getState().data;
    // While filtering, only suggest cards the user can see.
    const candidates = filtered ? new Set(Object.values(filtered.visible).flat()) : undefined;
    const next = pickNextTask(state, boardId, now, candidates);

    clearTimeout(timer.current ?? undefined);
    if (!next) {
      setHighlightedCardId(null);
      toast(
        filtered ? "Nothing to do among the shown cards." : "Nothing left to do here. Nice work!",
      );
      return;
    }

    setHighlightedCardId(next.cardId);
    timer.current = setTimeout(() => setHighlightedCardId(null), HIGHLIGHT_MS);
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(`[data-card-id="${next.cardId}"]`)?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
    toast(`Next up: ${state.cards[next.cardId]?.title ?? "a card"}`, {
      description:
        next.reasons.length > 0
          ? next.reasons.join(" · ")
          : "Nothing urgent — a good one to start with.",
      action: { label: "Open", onClick: () => openCard(next.cardId) },
    });
  }, [storeApi, filtered, boardId, now, openCard]);

  const value = useMemo(() => ({ highlightedCardId, suggest }), [highlightedCardId, suggest]);
  return <NextTaskContext.Provider value={value}>{children}</NextTaskContext.Provider>;
}

/** Whether this card is the current suggestion (false outside a provider). */
export function useIsSuggestedCard(cardId: string): boolean {
  return useContext(NextTaskContext)?.highlightedCardId === cardId;
}

export function NextTaskButton() {
  const context = useContext(NextTaskContext);
  if (!context) throw new Error("NextTaskButton must be used inside <NextTaskProvider>");
  return (
    <Button variant="outline" size="sm" onClick={context.suggest}>
      <Compass /> What should I do next?
    </Button>
  );
}
