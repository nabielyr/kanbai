import type { PersistedState } from "@/lib/domain/types";

// The data layer behind the board store. The UI never touches localStorage or the database
// directly; it gets an adapter (guest/demo → localStorage, signed in → Supabase in Phase 5).

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: PersistedState }
  /** Stored data was unreadable; it was moved aside to `backupKey` (if possible). */
  | { status: "corrupt"; reason: string; backupKey?: string };

export interface StorageAdapter {
  load(): Promise<LoadResult>;
  save(data: PersistedState): Promise<void>;
  clear(): Promise<void>;
  /** Optional: notifies when another tab or device changed the data. Returns an unsubscribe. */
  subscribe?(onExternalChange: () => void): () => void;
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
