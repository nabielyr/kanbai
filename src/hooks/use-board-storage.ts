"use client";

import { useMemo } from "react";
import type { StorageAdapter } from "@/lib/storage/adapter";
import {
  createLocalStorageAdapter,
  type StorageNamespace,
} from "@/lib/storage/local-storage-adapter";
import { createSupabaseAdapter } from "@/lib/storage/supabase-adapter";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAuthConfigured } from "@/lib/supabase/config";
import { useAuthUser } from "./use-auth-user";

export interface BoardStorage {
  adapter: StorageAdapter;
  /** Changes whenever the adapter does (e.g. on login), so callers can remount on it. */
  key: string;
  /** Set when the boards are saved to this user's account. */
  userId?: string;
}

/**
 * Where the boards live: signed-in users' workspace in their account, guests' workspace in
 * this browser, and the demo always in this browser. Null while the login state is unknown.
 */
export function useBoardStorage(namespace: StorageNamespace): BoardStorage | null {
  const auth = useAuthUser();
  const userId = auth.status === "signed-in" ? auth.user.id : null;
  const waitingForAuth =
    namespace === "workspace" && isAuthConfigured() && auth.status === "loading";

  return useMemo(() => {
    if (waitingForAuth) return null;
    if (namespace === "workspace" && userId) {
      // A user id only exists after useAuthUser's effect ran, so this is in the browser.
      const client = getSupabaseBrowserClient();
      if (client) {
        return {
          key: `account:${userId}`,
          adapter: createSupabaseAdapter(client, userId),
          userId,
        };
      }
    }
    return { key: namespace, adapter: createLocalStorageAdapter(namespace) };
  }, [namespace, userId, waitingForAuth]);
}
