"use client";

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  getFirstCollision,
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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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
import { SmartKeyboardSensor, SmartMouseSensor, SmartTouchSensor } from "./sensors";

const EMPTY: string[] = [];

/** Card ids shown in a column: the live drag preview while dragging, otherwise the store. */
const PreviewContext = createContext<ColumnItems | null>(null);

export function useColumnCardIds(columnId: string): string[] {
  const preview = useContext(PreviewContext);
  const stored = useBoardData((d) => d.columns[columnId]?.cardIds ?? EMPTY);
  return preview?.[columnId] ?? stored;
}

const screenReaderInstructions = {
  draggable:
    "To pick up a card, press Space or Enter. Use the arrow keys to move it, " +
    "Space or Enter to drop it, or Escape to cancel.",
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
  const { moveCard } = useBoardActions();
  const [preview, setPreview] = useState<ColumnItems | null>(null);
  const previewRef = useRef<ColumnItems | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedColumn = useRef(false);

  const sensors = useSensors(
    useSensor(SmartMouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press on touch screens so normal swiping still scrolls the board.
    useSensor(SmartTouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(SmartKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  const snapshot = useCallback((): ColumnItems => {
    const data = storeApi.getState().data;
    const columnIds = data.boards[boardId]?.columnIds ?? [];
    return Object.fromEntries(columnIds.map((id) => [id, data.columns[id]?.cardIds ?? []]));
  }, [storeApi, boardId]);

  /**
   * Pointer first (what's under the finger), then the closest card inside the hovered column.
   * Based on dnd-kit's multiple-containers example.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
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
    lastOverId.current = null;
  }

  function handleDragStart({ active }: DragStartEvent) {
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
    const cardTitle = (id: UniqueIdentifier) =>
      `“${storeApi.getState().data.cards[String(id)]?.title ?? "card"}”`;
    const columnTitle = (id: UniqueIdentifier) => {
      const columnId = previewRef.current ? findColumn(previewRef.current, String(id)) : undefined;
      return storeApi.getState().data.columns[columnId ?? String(id)]?.title ?? "a column";
    };
    return {
      onDragStart: ({ active }) => `Picked up card ${cardTitle(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `Card ${cardTitle(active.id)} is over ${columnTitle(over.id)}.`
          : `Card ${cardTitle(active.id)} is not over a column.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `Dropped card ${cardTitle(active.id)} in ${columnTitle(over.id)}.`
          : `Dropped card ${cardTitle(active.id)}.`,
      onDragCancel: ({ active }) => `Cancelled. Card ${cardTitle(active.id)} was put back.`,
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
      <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeCardId ? <CardDragPreview cardId={activeCardId} now={now} /> : null}
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
