import { z } from "zod";
import type { PersistedState } from "@/lib/domain/types";
import { browserStorage } from "@/lib/storage/local-storage-adapter";
import { DETAIL_LEVELS } from "./schemas";

// A chunk a guest asked for when their free tries ran out. It's remembered while they log in
// (OAuth and email links leave the page, maybe to another tab) and run again afterwards.
// localStorage, not sessionStorage: an email link opens a new tab.

export const PENDING_CHUNK_KEY = "kanbai:v1:pending-chunk";
/** Older requests are dropped: the visitor has moved on. */
export const PENDING_CHUNK_TTL_MS = 30 * 60 * 1000;

const pendingChunkSchema = z.object({
  cardId: z.string().min(1),
  cardTitle: z.string(),
  detail: z.enum(DETAIL_LEVELS),
  /** The page it was asked on (/boards or /demo); it's only resumed there. */
  path: z.string(),
  savedAt: z.number(),
});
export type PendingChunk = z.infer<typeof pendingChunkSchema>;

export function savePendingChunk(
  chunk: Omit<PendingChunk, "savedAt">,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
) {
  try {
    storage?.setItem(PENDING_CHUNK_KEY, JSON.stringify({ ...chunk, savedAt: now }));
  } catch {
    // Blocked storage: after login the visitor just clicks Chunk it again.
  }
}

/** The pending chunk, or null (none, unreadable, or expired; those are removed). */
export function readPendingChunk(
  now = Date.now(),
  storage: Storage | null = browserStorage(),
): PendingChunk | null {
  try {
    const raw = storage?.getItem(PENDING_CHUNK_KEY);
    if (!raw) return null;
    const parsed = pendingChunkSchema.safeParse(JSON.parse(raw));
    const age = parsed.success ? now - parsed.data.savedAt : Infinity;
    if (!parsed.success || age < 0 || age > PENDING_CHUNK_TTL_MS) {
      storage?.removeItem(PENDING_CHUNK_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearPendingChunk(storage: Storage | null = browserStorage()) {
  try {
    storage?.removeItem(PENDING_CHUNK_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Guest boards were imported with new ids: point the pending chunk at the card's copy. */
export function remapPendingChunk(
  cardIds: Record<string, string>,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
) {
  const pending = readPendingChunk(now, storage);
  const newId = pending && cardIds[pending.cardId];
  if (!pending || !newId) return;
  try {
    storage?.setItem(PENDING_CHUNK_KEY, JSON.stringify({ ...pending, cardId: newId }));
  } catch {
    // The title match below still finds it.
  }
}

/**
 * The card to resume on: the same id, or else (only when `matchTitle`) a card with the same
 * title on the active board (the account's copy of an untouched starter board).
 */
export function findPendingCard(
  data: PersistedState,
  pending: PendingChunk,
  matchTitle: boolean,
): string | null {
  if (data.cards[pending.cardId]) return pending.cardId;
  if (!matchTitle || !data.activeBoardId) return null;
  const board = data.boards[data.activeBoardId];
  for (const columnId of board?.columnIds ?? []) {
    for (const cardId of data.columns[columnId]?.cardIds ?? []) {
      if (data.cards[cardId]?.title === pending.cardTitle) return cardId;
    }
  }
  return null;
}
