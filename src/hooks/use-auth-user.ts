"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: User };

const LOADING: AuthState = { status: "loading", user: null };
const SIGNED_OUT: AuthState = { status: "signed-out", user: null };

/**
 * The logged-in user as this browser sees it, kept up to date on login and logout.
 * For display only: anything that needs trust checks the session on the server.
 */
export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>(LOADING);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session?.user ? { status: "signed-in", user: session.user } : SIGNED_OUT);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
