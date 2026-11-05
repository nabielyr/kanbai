import type { StorageAdapter } from "@/lib/storage/adapter";
import type { BoardStore } from "./board-store";

/** `pending`: changed, waiting for the debounce. `error`: the last save failed. */
export type SaveStatus = "saved" | "pending" | "saving" | "error";

export interface Autosave {
  /** Saves any pending change immediately (e.g. when the tab is being hidden). */
  flush(): Promise<void>;
  /** Skips saving the current state (used after loading external changes). */
  markSaved(): void;
  getStatus(): SaveStatus;
  stop(): void;
}

export interface AutosaveOptions {
  delayMs?: number;
  onError?: (error: unknown) => void;
  onSaved?: () => void;
  onStatusChange?: (status: SaveStatus) => void;
  /**
   * Waits before retrying a failed save, one entry per attempt (the last one repeats).
   * Without it, a failed save is only retried on the next change.
   */
  retryDelaysMs?: readonly number[];
  /** Return false for errors a retry can't fix. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Saves the store's data through `adapter`, debounced. Adapter-agnostic, so the same logic
 * serves localStorage and Supabase.
 */
export function startAutosave(
  store: BoardStore,
  adapter: StorageAdapter,
  options: AutosaveOptions = {},
): Autosave {
  const { delayMs = 300, onError, onSaved, onStatusChange, retryDelaysMs, shouldRetry } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let inFlight = 0;
  let failed = false;
  let stopped = false;
  let lastSaved = store.getState().data;
  let reported: SaveStatus = "saved";

  function getStatus(): SaveStatus {
    if (inFlight > 0) return "saving";
    if (store.getState().data === lastSaved) return "saved";
    if (failed) return "error";
    return "pending";
  }

  function report() {
    if (stopped) return;
    const status = getStatus();
    if (status === reported) return;
    reported = status;
    onStatusChange?.(status);
  }

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function scheduleRetry() {
    // A last flush can still fail after stop(); don't keep retrying for a closed board.
    if (stopped || !retryDelaysMs?.length) return;
    clearRetry();
    const wait = retryDelaysMs[Math.min(attempts, retryDelaysMs.length - 1)];
    attempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void save();
    }, wait);
  }

  async function save() {
    timer = null;
    const data = store.getState().data;
    if (data === lastSaved) return report();
    inFlight += 1;
    report();
    try {
      await adapter.save(data);
      lastSaved = data;
      failed = false;
      attempts = 0;
      clearRetry();
      onSaved?.();
    } catch (error) {
      failed = true;
      if (!stopped) onError?.(error);
      if (shouldRetry?.(error) ?? true) scheduleRetry();
    } finally {
      inFlight -= 1;
      report();
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, delayMs);
    report();
  });

  return {
    async flush() {
      if (timer) clearTimeout(timer);
      clearRetry();
      await save();
    },
    markSaved() {
      lastSaved = store.getState().data;
      failed = false;
      attempts = 0;
      clearRetry();
      report();
    },
    getStatus,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      clearRetry();
      unsubscribe();
    },
  };
}
