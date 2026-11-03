import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

/**
 * Refreshes the Supabase session before a request reaches the app, so the browser and the
 * server always work with a valid token. Called from src/proxy.ts. Without Supabase
 * configured, the request passes through untouched.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // The app reads the refreshed cookies from the request, the browser from the response.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // A response that sets auth cookies must never be cached and served to someone else.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  try {
    // Verifies the token and refreshes it when it has expired (which calls setAll above).
    await supabase.auth.getClaims();
  } catch {
    // Supabase unreachable: still serve the page. Guests and local boards don't need it.
  }
  return response;
}
