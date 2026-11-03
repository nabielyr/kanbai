export const DEFAULT_AFTER_LOGIN = "/boards";

const BASE = "http://kanbai.invalid";

/**
 * Where to send someone after logging in. Only paths on this site are allowed, so a crafted
 * `?next=//evil.com` link can't turn the login page into an open redirect.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    // Coming back to the login flow itself would be a loop.
    if (url.pathname === "/login" || url.pathname.startsWith("/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** The URL Supabase sends people back to after an email link or an OAuth provider. */
export function authCallbackUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

/** A link to the login page that returns to `next` afterwards. */
export function loginPath(next?: string | null): string {
  const target = safeNextPath(next);
  return target === DEFAULT_AFTER_LOGIN ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}
