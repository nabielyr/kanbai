"use client";

import { useEffect, useSyncExternalStore } from "react";
import { requestFreeTries } from "@/lib/ai/client";
import { useAuthUser } from "./use-auth-user";

// Free "Chunk it" tries left for a guest, shared by every badge on the page. Asked from the
// server once per logged-out visit, then kept current by each chunk response's header.

let freeTriesLeft: number | null = null;
let requested = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setFreeTriesLeft(value: number | null) {
  if (value === freeTriesLeft) return;
  freeTriesLeft = value;
  for (const listener of listeners) listener();
}

/** Forgets everything (tests, and after logging in). */
export function resetFreeTries() {
  requested = false;
  setFreeTriesLeft(null);
}

/** Tries left, or null when there's no limit to show (logged in, login off, unknown yet). */
export function useFreeTries(): number | null {
  const auth = useAuthUser();
  const value = useSyncExternalStore(
    subscribe,
    () => freeTriesLeft,
    () => null,
  );
  const signedOut = auth.status === "signed-out";

  useEffect(() => {
    if (auth.status === "signed-in") {
      // Logging out later starts a new guest visit.
      requested = false;
      return;
    }
    if (!signedOut || requested) return;
    requested = true;
    void requestFreeTries().then(setFreeTriesLeft);
  }, [auth.status, signedOut]);

  return signedOut ? value : null;
}
