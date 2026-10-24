import { StorageError, type LoadResult, type StorageAdapter } from "./adapter";
import { parsePersistedState } from "./persisted-schema";

export type StorageNamespace = "workspace" | "demo";

export function storageKey(namespace: StorageNamespace): string {
  return `kanbai:v1:${namespace}`;
}

/** Returns window.localStorage, or null when it's unavailable (SSR, blocked cookies, etc.). */
function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Stores the whole state as one JSON value per namespace. Reads are validated; corrupt values
 * are moved to a backup key instead of being silently discarded.
 */
export function createLocalStorageAdapter(
  namespace: StorageNamespace,
  storage: Storage | null = browserStorage(),
): StorageAdapter {
  const key = storageKey(namespace);

  return {
    async load(): Promise<LoadResult> {
      if (!storage) return { status: "empty" };

      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        return { status: "empty" };
      }
      if (raw === null) return { status: "empty" };

      let parsed: unknown;
      let reason: string;
      try {
        parsed = JSON.parse(raw);
        const result = parsePersistedState(parsed);
        if (result.ok) return { status: "ok", data: result.data };
        reason = result.reason;
      } catch {
        reason = "not valid JSON";
      }

      const backupKey = `${key}:corrupt-${Date.now()}`;
      try {
        storage.setItem(backupKey, raw);
        storage.removeItem(key);
        return { status: "corrupt", reason, backupKey };
      } catch {
        return { status: "corrupt", reason };
      }
    },

    async save(data) {
      if (!storage) throw new StorageError("Browser storage is not available");
      try {
        storage.setItem(key, JSON.stringify(data));
      } catch (error) {
        throw new StorageError("Could not write to browser storage (full or blocked)", error);
      }
    },

    async clear() {
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing to clear if storage is blocked.
      }
    },

    subscribe(onExternalChange) {
      if (typeof window === "undefined") return () => {};
      // Fired only in *other* tabs of the same origin when this key changes.
      const handler = (event: StorageEvent) => {
        if (event.key === key && event.storageArea === storage) onExternalChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
