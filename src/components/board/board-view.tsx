"use client";

import { AddColumn } from "@/components/column/add-column";
import { CardDialogProvider } from "@/components/card/card-dialog-context";
import { Column } from "@/components/column/column";
import { useBoardData } from "@/store/board-store-provider";
import { BoardTitle } from "./board-title";
import { BoardDnd } from "./dnd/board-dnd";

export function BoardView({
  boardId,
  now,
  toolbar,
}: {
  boardId: string;
  now: Date;
  /** Extra controls shown next to the board title. */
  toolbar?: React.ReactNode;
}) {
  const board = useBoardData((d) => d.boards[boardId]);
  if (!board) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-end gap-3 px-4 pt-6 pb-4 sm:px-6">
        <BoardTitle boardId={board.id} />
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>

      <CardDialogProvider>
        <BoardDnd boardId={board.id} now={now}>
          <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
            {board.columnIds.map((columnId) => (
              <Column key={columnId} columnId={columnId} now={now} />
            ))}
            <AddColumn boardId={board.id} />
          </div>
        </BoardDnd>
      </CardDialogProvider>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 sm:px-6" aria-busy="true">
      <div className="bg-muted h-8 w-64 animate-pulse rounded-lg" />
      <div className="mt-6 flex gap-4 overflow-hidden">
        {[5, 3, 2].map((count, i) => (
          <div key={i} className="bg-column w-[85vw] shrink-0 space-y-2 rounded-xl p-3 sm:w-72">
            <div className="bg-muted h-4 w-24 animate-pulse rounded" />
            {Array.from({ length: count }, (_, j) => (
              <div key={j} className="bg-card h-20 animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading board…</span>
    </div>
  );
}
