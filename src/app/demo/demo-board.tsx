"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardSkeleton, BoardView } from "@/components/board/board-view";
import { Button } from "@/components/ui/button";
import { createDemoState } from "@/lib/storage/demo-seed";
import { createLocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { PersistedBoardProvider } from "@/store/persisted-board-provider";

/** The demo board, saved in this browser under its own key (never mixed with real boards). */
export function DemoBoard() {
  const adapter = useMemo(() => createLocalStorageAdapter("demo"), []);
  const createInitialData = useCallback(() => createDemoState(new Date()), []);

  return (
    <PersistedBoardProvider
      adapter={adapter}
      createInitialData={createInitialData}
      fallback={<BoardSkeleton />}
    >
      <DemoBoardContent />
    </PersistedBoardProvider>
  );
}

function DemoBoardContent() {
  // Read the clock only in the browser, after the stored data has loaded.
  const [now] = useState(() => new Date());
  const boardId = useBoardData((d) => d.activeBoardId);
  if (!boardId) return null;
  return <BoardView boardId={boardId} now={now} toolbar={<ResetDemoButton />} />;
}

function ResetDemoButton() {
  const { replaceState } = useBoardActions();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        replaceState(createDemoState(new Date()));
        toast("Demo board reset");
      }}
    >
      <RotateCcw /> Reset demo
    </Button>
  );
}
