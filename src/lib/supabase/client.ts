import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | null | undefined;

/**
 * The browser Supabase client, created once. Null when Supabase isn't configured.
 * Call it from effects and event handlers, not during render (it touches document.cookie).
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = getSupabaseConfig();
  client = config ? createBrowserClient(config.url, config.key) : null;
  return client;
}
