import { Column } from "@/components/column/column";
import type { PersistedState } from "@/lib/domain/types";

interface BoardViewProps {
  state: PersistedState;
  boardId: string;
  now: Date;
}

export function BoardView({ state, boardId, now }: BoardViewProps) {
  const board = state.boards[boardId];
  if (!board) return null;

  const columns = board.columnIds.map((id) => state.columns[id]).filter(Boolean);
  const cardCount = columns.reduce((sum, column) => sum + column.cardIds.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{board.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {columns.length} columns · {cardCount} cards
        </p>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={column.cardIds.map((id) => state.cards[id]).filter(Boolean)}
            labels={board.labels}
            now={now}
          />
        ))}
      </div>
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
