import { CircleCheckBig } from "lucide-react";
import { CardTile } from "@/components/card/card-tile";
import type { Card, Column as ColumnModel, Label } from "@/lib/domain/types";

interface ColumnProps {
  column: ColumnModel;
  cards: Card[];
  labels: Label[];
  now: Date;
}

export function Column({ column, cards, labels, now }: ColumnProps) {
  const headingId = `column-${column.id}-title`;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-column flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl sm:w-72"
    >
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        {column.isDone && (
          <CircleCheckBig className="text-label-mint-foreground size-4" aria-hidden="true" />
        )}
        <h2 id={headingId} className="font-heading text-sm font-semibold">
          {column.title}
        </h2>
        <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
          {cards.length}
        </span>
      </header>

      <ol className="flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {cards.map((card) => (
          <li key={card.id}>
            <CardTile card={card} labels={labels} isDone={column.isDone} now={now} />
          </li>
        ))}
        {cards.length === 0 && (
          <li className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
            No cards yet
          </li>
        )}
      </ol>
    </section>
  );
}
