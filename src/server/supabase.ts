import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * A Supabase client for one request (route handlers, server actions, server components),
 * reading and writing the session cookies. Never share it between requests.
 * Null when Supabase isn't configured.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies. That's fine: the proxy refreshes the session.
        }
      },
    },
  });
}
