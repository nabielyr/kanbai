import type { PersistedState } from "@/lib/domain/types";

// The data layer behind the board store. The UI never touches localStorage or the database
// directly; it gets an adapter (guest/demo → localStorage, signed in → Supabase in Phase 5).

export type LoadResult =
  | { status: "empty" }
  /** `skippedBoards`: boards that couldn't be read and were left untouched where they are. */
  | { status: "ok"; data: PersistedState; skippedBoards?: number }
  /** Stored data was unreadable; it was moved aside to `backupKey` (if possible). */
  | { status: "corrupt"; reason: string; backupKey?: string };

export interface StorageAdapter {
  /** Rejects when the data couldn't be reached at all (e.g. offline), so nothing is overwritten. */
  load(): Promise<LoadResult>;
  save(data: PersistedState): Promise<void>;
  clear(): Promise<void>;
  /** Optional: notifies when another tab or device changed the data. Returns an unsubscribe. */
  subscribe?(onExternalChange: () => void): () => void;
  /** Saves over the network: failed saves are retried and the header shows the save status. */
  remote?: boolean;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/** Another device saved a newer version first; reload instead of overwriting it. */
export class StorageConflictError extends StorageError {
  constructor(readonly boardIds: string[]) {
    super(`Changed on another device: ${boardIds.join(", ")}`);
    this.name = "StorageConflictError";
  }
}
