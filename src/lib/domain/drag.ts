// Pure helpers for drag-and-drop previews. While dragging, the UI works on a lightweight
// copy of each column's (visible) card ids; on drop, `getDropTarget` turns that preview into
// the neighbour-based arguments `moveCard` expects.

/** Visible card ids per column id, in display order. */
export type ColumnItems = Record<string, string[]>;

/** The column an id belongs to: the id itself if it is a column, else the column holding it. */
export function findColumn(items: ColumnItems, id: string): string | undefined {
  if (id in items) return id;
  return Object.keys(items).find((columnId) => items[columnId].includes(id));
}

/**
 * Moves `activeId` into the column of `overId` (called while hovering a different column).
 * Over a card: inserted before it, or after it when `placeAfter` is true.
 * Over a column itself (e.g. an empty one): appended at the end.
 */
export function moveToColumn(
  items: ColumnItems,
  activeId: string,
  overId: string,
  placeAfter = false,
): ColumnItems {
  const from = findColumn(items, activeId);
  const to = findColumn(items, overId);
  if (!from || !to || from === to) return items;

  const target = items[to].filter((id) => id !== activeId);
  let index = overId === to ? target.length : target.indexOf(overId);
  if (index === -1) index = target.length;
  else if (placeAfter && overId !== to) index += 1;

  return {
    ...items,
    [from]: items[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  };
}

/** Reorders `activeId` onto the position of `overId` inside the same column. */
export function reorderInColumn(items: ColumnItems, activeId: string, overId: string): ColumnItems {
  const column = findColumn(items, activeId);
  if (!column || column !== findColumn(items, overId) || overId === column) return items;

  const ids = items[column];
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return items;

  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return { ...items, [column]: next };
}

/** Where the dragged card ended up: its column and the card right after it (or null). */
export function getDropTarget(
  items: ColumnItems,
  activeId: string,
): { columnId: string; beforeCardId: string | null } | null {
  const columnId = findColumn(items, activeId);
  if (!columnId || columnId === activeId) return null;
  const ids = items[columnId];
  return { columnId, beforeCardId: ids[ids.indexOf(activeId) + 1] ?? null };
}
