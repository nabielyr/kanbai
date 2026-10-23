"use client";

import { useState } from "react";
import { BoardSkeleton, BoardView } from "@/components/board/board-view";
import { useHydrated } from "@/hooks/use-hydrated";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";

// Static demo board (Step 1.4). The store and persistence replace this in Phase 2.
export function DemoBoard() {
  const hydrated = useHydrated();
  // Dates depend on the viewer's clock and timezone, so they are only read in the browser.
  return hydrated ? <ClientDemoBoard /> : <BoardSkeleton />;
}

function ClientDemoBoard() {
  const [now] = useState(() => new Date());
  const [state] = useState(() => createDemoState(now));
  return <BoardView state={state} boardId={DEMO_BOARD_ID} now={now} />;
}
