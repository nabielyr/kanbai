import type { PersistedState } from "@/lib/domain/types";
import { browserStorage, storageKey } from "./local-storage-adapter";
import { parsePersistedState } from "./persisted-schema";
import { isUntouchedWorkspace } from "./workspace-seed";

// Boards made as a guest in this browser, offered to the account on login. Reading never
// changes anything, unlike the adapter's load() which moves corrupt data aside.

export interface GuestBoards {
  data: PersistedState;
  titles: string[];
  /** Identifies this exact guest data, so "Skip" isn't asked again until it changes. */
  fingerprint: string;
}

export function guestImportKey(userId: string): string {
  return `kanbai:v1:account:${userId}:guest-import`;
}

/** A short, stable hash (djb2), only used to notice that the guest data changed. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return `${text.length}-${(h >>> 0).toString(36)}`;
}

/** The guest boards worth offering to `userId`, or null (none, untouched starter, or handled). */
export function findGuestBoardsToImport(
  userId: string,
  storage: Storage | null = browserStorage(),
): GuestBoards | null {
  try {
    const raw = storage?.getItem(storageKey("workspace"));
    if (!raw) return null;
    const fingerprint = hash(raw);
    if (storage?.getItem(guestImportKey(userId)) === fingerprint) return null;

    const parsed = parsePersistedState(JSON.parse(raw));
    if (!parsed.ok || parsed.data.boardOrder.length === 0) return null;
    if (isUntouchedWorkspace(parsed.data)) return null;
    const titles = parsed.data.boardOrder.map((id) => parsed.data.boards[id].title);
    return { data: parsed.data, titles, fingerprint };
  } catch {
    return null;
  }
}

/** Don't offer this guest data to `userId` again (imported, or skipped). */
export function markGuestBoardsHandled(
  userId: string,
  fingerprint: string,
  storage: Storage | null = browserStorage(),
) {
  try {
    storage?.setItem(guestImportKey(userId), fingerprint);
  } catch {
    // At worst the offer shows up again.
  }
}

export function clearGuestBoards(storage: Storage | null = browserStorage()) {
  try {
    storage?.removeItem(storageKey("workspace"));
  } catch {
    // Blocked storage: nothing was there to clear.
  }
}
