"use client";

import { useEffect, useSyncExternalStore } from "react";
import { requestQuota } from "@/lib/ai/client";
import { useAuthUser } from "./use-auth-user";

// Chunks a logged-in user has left today, shared by every badge on the page. Asked from the
// server once per login, then kept current by each chunk response's header.

let chunksLeft: number | null = null;
let requested = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setChunksLeftToday(value: number | null) {
  if (value === chunksLeft) return;
  chunksLeft = value;
  for (const listener of listeners) listener();
}

/** Forgets everything (tests, and after logging out). */
export function resetChunksLeft() {
  requested = false;
  setChunksLeftToday(null);
}

/** Chunks left today, or null when there's nothing to show (guest, no daily limit, unknown yet). */
export function useChunksLeftToday(): number | null {
  const auth = useAuthUser();
  const value = useSyncExternalStore(
    subscribe,
    () => chunksLeft,
    () => null,
  );
  const signedIn = auth.status === "signed-in";

  useEffect(() => {
    if (!signedIn) {
      // Logging in again (maybe as someone else) starts fresh.
      if (auth.status === "signed-out") resetChunksLeft();
      return;
    }
    if (requested) return;
    requested = true;
    void requestQuota().then((quota) => setChunksLeftToday(quota.chunksLeftToday));
  }, [auth.status, signedIn]);

  return signedIn ? value : null;
}
