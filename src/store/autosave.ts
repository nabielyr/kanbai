import type { StorageAdapter } from "@/lib/storage/adapter";
import type { BoardStore } from "./board-store";

export interface Autosave {
  /** Saves any pending change immediately (e.g. when the tab is being hidden). */
  flush(): Promise<void>;
  /** Skips saving the current state (used after loading external changes). */
  markSaved(): void;
  stop(): void;
}

/**
 * Saves the store's data through `adapter`, debounced. Adapter-agnostic, so the same logic
 * serves localStorage now and Supabase later.
 */
export function startAutosave(
  store: BoardStore,
  adapter: StorageAdapter,
  options: { delayMs?: number; onError?: (error: unknown) => void; onSaved?: () => void } = {},
): Autosave {
  const { delayMs = 300, onError, onSaved } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = store.getState().data;

  async function save() {
    timer = null;
    const data = store.getState().data;
    if (data === lastSaved) return;
    try {
      await adapter.save(data);
      lastSaved = data;
      onSaved?.();
    } catch (error) {
      onError?.(error);
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, delayMs);
  });

  return {
    async flush() {
      if (timer) clearTimeout(timer);
      await save();
    },
    markSaved() {
      lastSaved = store.getState().data;
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      unsubscribe();
    },
  };
}
