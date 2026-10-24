"use client";

import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import type { PersistedState } from "@/lib/domain/types";
import { createBoardStore, type BoardActions, type BoardStore } from "./board-store";

// One store per provider (demo, guest workspace, signed-in user) instead of a global singleton,
// so data never leaks between storage namespaces or between server requests.

const BoardStoreContext = createContext<BoardStore | null>(null);

export function BoardStoreProvider({
  initialData,
  store: externalStore,
  children,
}: {
  initialData?: PersistedState;
  /** Pass an existing store (e.g. in tests or when persistence owns it). */
  store?: BoardStore;
  children: React.ReactNode;
}) {
  const [ownStore] = useState<BoardStore | null>(() => {
    if (externalStore) return null;
    if (!initialData) throw new Error("BoardStoreProvider needs `initialData` or `store`");
    return createBoardStore(initialData);
  });
  const store = externalStore ?? ownStore!;
  return <BoardStoreContext.Provider value={store}>{children}</BoardStoreContext.Provider>;
}

/** The raw store, for reading state imperatively in event handlers (no re-renders). */
export function useBoardStoreApi(): BoardStore {
  const store = useContext(BoardStoreContext);
  if (!store) throw new Error("Board store hooks must be used inside <BoardStoreProvider>");
  return store;
}

/** Subscribes to a slice of the board data; re-renders only when that slice changes. */
export function useBoardData<T>(selector: (data: PersistedState) => T): T {
  return useStore(useBoardStoreApi(), (state) => selector(state.data));
}

/** Stable action functions; never causes a re-render. */
export function useBoardActions(): BoardActions {
  return useStore(useBoardStoreApi(), (state) => state.actions);
}
