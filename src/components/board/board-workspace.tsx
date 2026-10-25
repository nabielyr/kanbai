"use client";

import { LayoutGrid, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import type { PersistedState } from "@/lib/domain/types";
import {
  createLocalStorageAdapter,
  type StorageNamespace,
} from "@/lib/storage/local-storage-adapter";
import { useBoardData } from "@/store/board-store-provider";
import { PersistedBoardProvider } from "@/store/persisted-board-provider";
import { BoardSwitcher } from "./board-switcher";
import { BoardSkeleton, BoardView } from "./board-view";
import { NewBoardDialog } from "./new-board-dialog";

interface BoardWorkspaceProps {
  namespace: StorageNamespace;
  /** Starting data when nothing is stored yet. Must be stable (module-level or memoized). */
  createInitialData: () => PersistedState;
  /** Extra controls next to the board title (e.g. "Reset demo"). */
  toolbar?: React.ReactNode;
  /** Shown above the board (e.g. the demo banner). */
  banner?: React.ReactNode;
}

/** Header + board switcher + the active board, backed by a localStorage namespace. */
export function BoardWorkspace({
  namespace,
  createInitialData,
  toolbar,
  banner,
}: BoardWorkspaceProps) {
  const adapter = useMemo(() => createLocalStorageAdapter(namespace), [namespace]);

  return (
    <PersistedBoardProvider
      adapter={adapter}
      createInitialData={createInitialData}
      fallback={
        <>
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col">
            {banner}
            <BoardSkeleton />
          </main>
        </>
      }
    >
      <AppHeader>
        <BoardSwitcher />
      </AppHeader>
      <main className="flex min-h-0 flex-1 flex-col">
        {banner}
        <ActiveBoard toolbar={toolbar} />
      </main>
    </PersistedBoardProvider>
  );
}

function ActiveBoard({ toolbar }: { toolbar?: React.ReactNode }) {
  // Read the clock only in the browser, after the stored data has loaded.
  const [now] = useState(() => new Date());
  const boardId = useBoardData((d) => d.activeBoardId);
  if (!boardId) return <NoBoards />;
  return <BoardView key={boardId} boardId={boardId} now={now} toolbar={toolbar} />;
}

function NoBoards() {
  const [creating, setCreating] = useState(false);
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <span className="bg-muted text-muted-foreground mb-4 rounded-2xl p-4">
        <LayoutGrid className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold">No boards yet</h1>
      <p className="text-muted-foreground mt-2">
        Create a board for a project, a goal, or anything with steps.
      </p>
      <Button className="mt-6" onClick={() => setCreating(true)}>
        <Plus /> Create a board
      </Button>
      <NewBoardDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
