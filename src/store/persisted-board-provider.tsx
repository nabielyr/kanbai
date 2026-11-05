"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { createEmptyState } from "@/lib/domain/board-ops";
import type { PersistedState } from "@/lib/domain/types";
import { StorageConflictError, type LoadResult, type StorageAdapter } from "@/lib/storage/adapter";
import { startAutosave, type Autosave, type SaveStatus } from "./autosave";
import { createBoardStore, type BoardStore } from "./board-store";
import { BoardStoreProvider } from "./board-store-provider";

/** What the header shows for boards saved to the account. */
export type SyncStatus = "saved" | "saving" | "offline" | "error";

const SyncStatusContext = createContext<SyncStatus | null>(null);

/** The account save status, or null when boards are only kept in this browser. */
export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncStatusContext);
}

const SaveNowContext = createContext<() => Promise<boolean>>(async () => false);

/** Saves pending changes right away; resolves true once everything is saved. */
export function useSaveNow(): () => Promise<boolean> {
  return useContext(SaveNowContext);
}

/** Batches quick edits into one request per board. */
const REMOTE_SAVE_DELAY_MS = 600;
const REMOTE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOffline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => !navigator.onLine,
    () => false,
  );
}

interface PersistedBoardProviderProps {
  /** Must be stable (memoized) — a new adapter reloads everything. */
  adapter: StorageAdapter;
  /** Builds the starting data when nothing (valid) is stored yet. Must be stable. */
  createInitialData: () => PersistedState;
  /** Shown until the stored data has been loaded (also during SSR). */
  fallback: React.ReactNode;
  /** Shown when the boards couldn't be loaded at all (e.g. offline). */
  loadError?: (retry: () => void) => React.ReactNode;
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
  loadError,
  children,
}: PersistedBoardProviderProps) {
  const [store, setStore] = useState<BoardStore | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const offline = useOffline();
  const autosaveRef = useRef<Autosave | null>(null);
  const saveNow = useCallback(async () => {
    const autosave = autosaveRef.current;
    if (!autosave) return false;
    await autosave.flush();
    return autosave.getStatus() === "saved";
  }, []);
  // Shared between React StrictMode's double effect run, so a "corrupt data" result
  // (which moves the bad value aside) is still reported exactly once.
  const loadRef = useRef<{
    adapter: StorageAdapter;
    attempt: number;
    promise: Promise<LoadResult>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let autosave: Autosave | null = null;
    let unsubscribeExternal: (() => void) | undefined;
    let warnedAboutSaving = false;
    const remote = adapter.remote === true;

    if (loadRef.current?.adapter !== adapter || loadRef.current.attempt !== attempt) {
      loadRef.current = { adapter, attempt, promise: adapter.load() };
    }
    const loading = loadRef.current.promise;

    void loading.then(
      (result) => {
        if (cancelled) return;

        if (result.status === "corrupt") {
          toast.error("Your saved board couldn’t be read, so we started fresh.", {
            description: result.backupKey ? "A backup copy was kept in this browser." : undefined,
          });
        }
        if (result.status === "ok" && result.skippedBoards) {
          toast.warning(
            result.skippedBoards === 1
              ? "1 board couldn’t be read, so it’s hidden."
              : `${result.skippedBoards} boards couldn’t be read, so they’re hidden.`,
            { description: "It was left untouched in your account." },
          );
        }

        const boardStore = createBoardStore(
          result.status === "ok" ? result.data : createInitialData(),
        );

        // Shows what another tab or device saved, without saving it straight back.
        let reloading = false;
        let conflicted = false;
        const reload = async () => {
          if (reloading || cancelled) return;
          reloading = true;
          try {
            // Send this device's unsaved edits first, unless that's exactly what conflicted.
            if (remote && !conflicted) await autosave?.flush();
            const next = await adapter.load();
            if (cancelled) return;
            if (next.status === "ok") boardStore.getState().actions.replaceState(next.data);
            else if (remote && next.status === "empty") {
              boardStore.getState().actions.replaceState(createEmptyState());
            } else return;
            autosave?.markSaved();
            if (conflicted) {
              conflicted = false;
              toast("A board was changed on another device.", {
                description: "We loaded the latest version.",
              });
            }
          } catch {
            // Keep what's on screen; the next check or save tries again.
          } finally {
            reloading = false;
          }
        };

        autosave = startAutosave(
          boardStore,
          adapter,
          remote
            ? {
                delayMs: REMOTE_SAVE_DELAY_MS,
                retryDelaysMs: REMOTE_RETRY_DELAYS_MS,
                shouldRetry: (error) => !(error instanceof StorageConflictError),
                onStatusChange: setSaveStatus,
                onError: (error) => {
                  if (error instanceof StorageConflictError) {
                    conflicted = true;
                    void reload();
                    return;
                  }
                  if (warnedAboutSaving || !navigator.onLine) return;
                  warnedAboutSaving = true;
                  toast.error("Couldn’t save your changes.", {
                    description: "We’ll keep trying. Keep this tab open until it says Saved.",
                  });
                },
                onSaved: () => {
                  warnedAboutSaving = false;
                },
              }
            : {
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
              },
        );

        unsubscribeExternal = adapter.subscribe?.(() => void reload());
        autosaveRef.current = autosave;
        setStore(boardStore);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );

    const flush = () => void autosave?.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // Unsaved account changes: ask before closing the tab.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (remote && autosave && autosave.getStatus() !== "saved") event.preventDefault();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribeExternal?.();
      if (autosaveRef.current === autosave) autosaveRef.current = null;
      if (autosave) {
        void autosave.flush();
        autosave.stop();
      }
    };
  }, [adapter, createInitialData, attempt]);

  if (!store) {
    if (loadFailed && loadError) {
      return (
        <>
          {loadError(() => {
            setLoadFailed(false);
            setAttempt((n) => n + 1);
          })}
        </>
      );
    }
    return <>{fallback}</>;
  }

  let syncStatus: SyncStatus | null = null;
  if (adapter.remote) {
    if (offline) syncStatus = "offline";
    else if (saveStatus === "saved") syncStatus = "saved";
    else if (saveStatus === "error") syncStatus = "error";
    else syncStatus = "saving";
  }

  return (
    <SyncStatusContext.Provider value={syncStatus}>
      <SaveNowContext.Provider value={saveNow}>
        <BoardStoreProvider store={store}>{children}</BoardStoreProvider>
      </SaveNowContext.Provider>
    </SyncStatusContext.Provider>
  );
}
