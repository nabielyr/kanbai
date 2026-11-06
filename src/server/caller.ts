import "server-only";
import { createSupabaseServerClient } from "./supabase";

/**
 * Who is asking: a logged-in user, a guest, or anyone at all when login isn't set up
 * (then there's no way to log in, so guest limits can't apply).
 */
export type Caller = { kind: "user"; userId: string } | { kind: "guest" } | { kind: "no-login" };

export async function identifyCaller(): Promise<Caller> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "no-login" };
  try {
    // getClaims verifies the session token, unlike getSession which trusts the cookie.
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;
    if (!error && typeof userId === "string" && userId) return { kind: "user", userId };
  } catch {
    // An unreadable session counts as a guest.
  }
  return { kind: "guest" };
}
