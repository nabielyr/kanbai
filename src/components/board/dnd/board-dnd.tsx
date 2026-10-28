"use client";

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardCode,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CardTile } from "@/components/card/card-tile";
import {
  findColumn,
  getDropTarget,
  moveToColumn,
  reorderInColumn,
  type ColumnItems,
} from "@/lib/domain/drag";
import { useBoardActions, useBoardData, useBoardStoreApi } from "@/store/board-store-provider";
import { useFilteredBoard } from "../board-filters";
import { SmartKeyboardSensor, SmartMouseSensor, SmartTouchSensor } from "./sensors";

const EMPTY: string[] = [];

/**
 * Card ids shown in a column: the live drag preview while dragging, otherwise the cards that
 * match the current filters (or all of them when nothing is filtered).
 */
const PreviewContext = createContext<ColumnItems | null>(null);

export function useColumnCardIds(columnId: string): string[] {
  const preview = useContext(PreviewContext);
  const filtered = useFilteredBoard();
  const stored = useBoardData((d) => d.columns[columnId]?.cardIds ?? EMPTY);
  return preview?.[columnId] ?? filtered?.visible[columnId] ?? stored;
}

const screenReaderInstructions = {
  draggable:
    "Press Enter to open. To move it, press Space to pick it up, use the arrow keys, " +
    "then Space or Enter to drop it, or Escape to cancel.",
};

export function BoardDnd({
  boardId,
  now,
  children,
}: {
  boardId: string;
  now: Date;
  children: React.ReactNode;
}) {
  const storeApi = useBoardStoreApi();
  const { moveCard, moveColumn } = useBoardActions();
  const columnIds = useBoardData((d) => d.boards[boardId]?.columnIds ?? EMPTY);
  const [preview, setPreview] = useState<ColumnItems | null>(null);
  const previewRef = useRef<ColumnItems | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedColumn = useRef(false);

  const sensors = useSensors(
    useSensor(SmartMouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press on touch screens so normal swiping still scrolls the board.
    useSensor(SmartTouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(SmartKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space picks up; Enter is left free to open the card.
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Enter],
      },
    }),
  );

  const updatePreview = useCallback((items: ColumnItems | null) => {
    previewRef.current = items;
    setPreview(items);
  }, []);

  useEffect(() => {
    // Let layout settle for a frame after a card jumps columns (avoids flicker loops).
    const frame = requestAnimationFrame(() => {
      recentlyMovedColumn.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [preview]);

  const filtered = useFilteredBoard();

  /**
   * The drag preview starts from the visible cards only. Drops are saved relative to the
   * next visible card (see moveCard), so hidden cards keep their places.
   */
  const snapshot = useCallback((): ColumnItems => {
    if (filtered) return filtered.visible;
    const data = storeApi.getState().data;
    const columnIds = data.boards[boardId]?.columnIds ?? [];
    return Object.fromEntries(columnIds.map((id) => [id, data.columns[id]?.cardIds ?? []]));
  }, [filtered, storeApi, boardId]);

  /**
   * Pointer first (what's under the finger), then the closest card inside the hovered column.
   * Based on dnd-kit's multiple-containers example.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (args.active.data.current?.type === "column") {
      // Columns only ever swap places with other columns.
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) => container.data.current?.type === "column",
        ),
      });
    }

    const items = previewRef.current;
    if (!items) return closestCorners(args);

    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    let overId = getFirstCollision(hits, "id");

    if (overId != null) {
      const columnCards = items[String(overId)];
      if (columnCards && columnCards.length > 0) {
        const closest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id !== overId && columnCards.includes(String(container.id)),
          ),
        });
        overId = closest[0]?.id ?? overId;
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMovedColumn.current) lastOverId.current = args.active.id;
    return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
  }, []);

  function reset() {
    updatePreview(null);
    setActiveCardId(null);
    setActiveColumnId(null);
    lastOverId.current = null;
  }

  function handleDragStart({ active }: DragStartEvent) {
    if (active.data.current?.type === "column") {
      setActiveColumnId(String(active.id));
      return;
    }
    if (active.data.current?.type !== "card") return;
    setActiveCardId(String(active.id));
    updatePreview(snapshot());
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const items = previewRef.current;
    if (!items || !over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const to = findColumn(items, overId);
    if (!to || findColumn(items, activeId) === to) return;

    const dragged = active.rect.current.translated;
    const placeAfter =
      overId !== to && dragged != null && dragged.top > over.rect.top + over.rect.height / 2;
    recentlyMovedColumn.current = true;
    updatePreview(moveToColumn(items, activeId, overId, placeAfter));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (active.data.current?.type === "column") {
      if (over) {
        const data = storeApi.getState().data;
        const overId = String(over.id);
        const overColumnId = data.columns[overId] ? overId : data.cards[overId]?.columnId;
        const toIndex = overColumnId ? columnIds.indexOf(overColumnId) : -1;
        if (toIndex !== -1) moveColumn(String(active.id), toIndex);
      }
      reset();
      return;
    }

    const items = previewRef.current;
    if (items && over) {
      const activeId = String(active.id);
      const final = reorderInColumn(items, activeId, String(over.id));
      const target = getDropTarget(final, activeId);
      if (target) moveCard(activeId, target.columnId, target.beforeCardId);
    }
    reset();
  }

  const announcements: Announcements = useMemo(() => {
    const describe = (id: UniqueIdentifier) => {
      const data = storeApi.getState().data;
      const card = data.cards[String(id)];
      if (card) return `card “${card.title}”`;
      const column = data.columns[String(id)];
      return column ? `column “${column.title}”` : "item";
    };
    const capitalized = (id: UniqueIdentifier) => {
      const text = describe(id);
      return text.charAt(0).toUpperCase() + text.slice(1);
    };
    const columnTitle = (id: UniqueIdentifier) => {
      const columnId = previewRef.current ? findColumn(previewRef.current, String(id)) : undefined;
      return storeApi.getState().data.columns[columnId ?? String(id)]?.title ?? "a column";
    };
    const isColumn = (id: UniqueIdentifier) =>
      Boolean(storeApi.getState().data.columns[String(id)]);
    return {
      onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
      onDragOver: ({ active, over }) => {
        if (!over) return `${capitalized(active.id)} is not over a drop target.`;
        return isColumn(active.id)
          ? `${capitalized(active.id)} is over ${describe(over.id)}.`
          : `${capitalized(active.id)} is over ${columnTitle(over.id)}.`;
      },
      onDragEnd: ({ active, over }) => {
        if (!over) return `Dropped ${describe(active.id)}.`;
        return isColumn(active.id)
          ? `Moved ${describe(active.id)}.`
          : `Dropped ${describe(active.id)} in ${columnTitle(over.id)}.`;
      },
      onDragCancel: ({ active }) => `Cancelled. ${capitalized(active.id)} was put back.`,
    };
  }, [storeApi]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <PreviewContext.Provider value={preview}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </PreviewContext.Provider>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeCardId ? <CardDragPreview cardId={activeCardId} now={now} /> : null}
        {activeColumnId ? <ColumnDragPreview columnId={activeColumnId} now={now} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** The "lifted" card that follows the pointer while dragging. */
function CardDragPreview({ cardId, now }: { cardId: string; now: Date }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const labels = useBoardData((d) => (card ? d.boards[card.boardId]?.labels : undefined));
  if (!card) return null;
  return (
    <CardTile
      card={card}
      labels={labels ?? []}
      now={now}
      className="shadow-lift hover:shadow-lift scale-[1.03] rotate-2 cursor-grabbing"
    />
  );
}

/** A compact copy of the column that follows the pointer while reordering columns. */
function ColumnDragPreview({ columnId, now }: { columnId: string; now: Date }) {
  const column = useBoardData((d) => d.columns[columnId]);
  const cards = useBoardData((d) => d.cards);
  const labels = useBoardData((d) => (column ? d.boards[column.boardId]?.labels : undefined));
  if (!column) return null;
  return (
    <div className="bg-column shadow-lift w-72 rotate-1 cursor-grabbing rounded-xl p-2">
      <p className="font-heading px-2 pt-1 pb-2 text-sm font-semibold">
        {column.title}{" "}
        <span className="text-muted-foreground font-sans text-xs">{column.cardIds.length}</span>
      </p>
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-hidden">
        {column.cardIds
          .slice(0, 4)
          .map((id) =>
            cards[id] ? (
              <CardTile
                key={id}
                card={cards[id]}
                labels={labels ?? []}
                isDone={column.isDone}
                now={now}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}
