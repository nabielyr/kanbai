import type { User } from "@supabase/supabase-js";
import { vi } from "vitest";

/** A user as Supabase returns it, with only the fields the UI reads. */
export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "nabiel@example.com",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  } as User;
}

/**
 * A stand-in for the browser Supabase client. `onAuthStateChange` reports `user` right away,
 * like Supabase's INITIAL_SESSION event.
 */
export function createFakeSupabase(user: User | null = null) {
  const auth = {
    onAuthStateChange: vi.fn(
      (callback: (event: string, session: { user: User } | null) => void) => {
        callback("INITIAL_SESSION", user ? { user } : null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    ),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null as unknown })),
  };
  return { auth };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

/** Makes isAuthConfigured() true for the current test. Undo with vi.unstubAllEnvs(). */
export function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
}
