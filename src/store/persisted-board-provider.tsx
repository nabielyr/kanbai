"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PersistedState } from "@/lib/domain/types";
import type { LoadResult, StorageAdapter } from "@/lib/storage/adapter";
import { startAutosave, type Autosave } from "./autosave";
import { createBoardStore, type BoardStore } from "./board-store";
import { BoardStoreProvider } from "./board-store-provider";

interface PersistedBoardProviderProps {
  /** Must be stable (memoized) — a new adapter reloads everything. */
  adapter: StorageAdapter;
  /** Builds the starting data when nothing (valid) is stored yet. Must be stable. */
  createInitialData: () => PersistedState;
  /** Shown until the stored data has been loaded (also during SSR). */
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Loads board data from a storage adapter, then provides a store that autosaves back to it.
 * Renders only on the client, so stored data and local dates never cause hydration mismatches.
 */
export function PersistedBoardProvider({
  adapter,
  createInitialData,
  fallback,
  children,
}: PersistedBoardProviderProps) {
  const [store, setStore] = useState<BoardStore | null>(null);
  // Shared between React StrictMode's double effect run, so a "corrupt data" result
  // (which moves the bad value aside) is still reported exactly once.
  const loadRef = useRef<{ adapter: StorageAdapter; promise: Promise<LoadResult> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let autosave: Autosave | null = null;
    let unsubscribeExternal: (() => void) | undefined;
    let warnedAboutSaving = false;

    if (loadRef.current?.adapter !== adapter) {
      loadRef.current = { adapter, promise: adapter.load() };
    }
    const loading = loadRef.current.promise;

    void loading.then((result) => {
      if (cancelled) return;

      if (result.status === "corrupt") {
        toast.error("Your saved board couldn’t be read, so we started fresh.", {
          description: result.backupKey ? "A backup copy was kept in this browser." : undefined,
        });
      }

      const boardStore = createBoardStore(
        result.status === "ok" ? result.data : createInitialData(),
      );
      autosave = startAutosave(boardStore, adapter, {
        onError: () => {
          if (warnedAboutSaving) return;
          warnedAboutSaving = true;
          toast.error("Changes can’t be saved in this browser.", {
            description: "Storage may be full or blocked (e.g. private browsing).",
          });
        },
        onSaved: () => {
          warnedAboutSaving = false;
        },
      });

      // Another tab changed the data: show it here without saving it straight back.
      unsubscribeExternal = adapter.subscribe?.(() => {
        void adapter.load().then((next) => {
          if (next.status !== "ok") return;
          boardStore.getState().actions.replaceState(next.data);
          autosave?.markSaved();
        });
      });

      setStore(boardStore);
    });

    const flush = () => void autosave?.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribeExternal?.();
      if (autosave) {
        void autosave.flush();
        autosave.stop();
      }
    };
  }, [adapter, createInitialData]);

  if (!store) return <>{fallback}</>;
  return <BoardStoreProvider store={store}>{children}</BoardStoreProvider>;
}
