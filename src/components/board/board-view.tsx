"use client";

import { AddColumn } from "@/components/column/add-column";
import { CardDialogProvider } from "@/components/card/card-dialog-context";
import { ChunkDialogProvider } from "@/components/chunk/chunk-dialog-context";
import { Column } from "@/components/column/column";
import { useBoardData } from "@/store/board-store-provider";
import { BoardFiltersProvider, FilterBar } from "./board-filters";
import { BoardTitle } from "./board-title";
import { KeyboardShortcutsProvider, ShortcutsButton } from "./keyboard-shortcuts";
import { NextTaskButton, NextTaskProvider } from "./next-task";
import { BoardDnd, BoardScroller } from "./dnd/board-dnd";

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
    <BoardFiltersProvider boardId={board.id} now={now}>
      <ChunkDialogProvider>
        <CardDialogProvider now={now}>
          <NextTaskProvider boardId={board.id} now={now}>
            <KeyboardShortcutsProvider boardColumnIds={board.columnIds}>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-end gap-3 px-4 pt-6 pb-3 sm:px-6">
                  <BoardTitle boardId={board.id} />
                  {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
                </div>
                <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-2 px-4 pb-4 sm:px-6">
                  <FilterBar boardId={board.id} />
                  <div className="flex items-center gap-1 sm:ml-auto">
                    <NextTaskButton />
                    <ShortcutsButton />
                  </div>
                </div>

                <BoardDnd boardId={board.id} now={now}>
                  <BoardScroller>
                    {board.columnIds.length === 0 && <EmptyBoardNote />}
                    {board.columnIds.map((columnId) => (
                      <Column key={columnId} columnId={columnId} now={now} />
                    ))}
                    <AddColumn boardId={board.id} />
                  </BoardScroller>
                </BoardDnd>
              </div>
            </KeyboardShortcutsProvider>
          </NextTaskProvider>
        </CardDialogProvider>
      </ChunkDialogProvider>
    </BoardFiltersProvider>
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

/** A board without columns: a taped note pointing at "Add column". */
function EmptyBoardNote() {
  return (
    <div className="bg-card shadow-paper relative w-[85vw] shrink-0 snap-center rounded-md border p-4 sm:w-72">
      <span
        aria-hidden="true"
        className="washi-tape bg-tape-soon absolute -top-1.5 left-1/2 h-3.5 w-14 -translate-x-1/2 -rotate-2"
      />
      <h2 className="font-sans text-sm font-semibold tracking-normal">This board is empty</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Add a column to start, like &ldquo;To Do&rdquo;, &ldquo;Doing&rdquo; and &ldquo;Done&rdquo;.
      </p>
    </div>
  );
}
