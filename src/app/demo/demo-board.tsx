"use client";

import { useState } from "react";
import { BoardSkeleton, BoardView } from "@/components/board/board-view";
import { useHydrated } from "@/hooks/use-hydrated";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { BoardStoreProvider } from "@/store/board-store-provider";

// Demo board backed by an in-memory store. Persistence arrives in Step 2.6.
export function DemoBoard() {
  const hydrated = useHydrated();
  // Dates depend on the viewer's clock and timezone, so they are only read in the browser.
  return hydrated ? <ClientDemoBoard /> : <BoardSkeleton />;
}

function ClientDemoBoard() {
  const [now] = useState(() => new Date());
  const [initialData] = useState(() => createDemoState(now));
  return (
    <BoardStoreProvider initialData={initialData}>
      <BoardView boardId={DEMO_BOARD_ID} now={now} />
    </BoardStoreProvider>
  );
}
