import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { toLoginErrorCode, type LoginErrorCode } from "@/lib/auth/login-errors";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/server/supabase";

const EMAIL_OTP_TYPES: readonly string[] = [
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
] satisfies EmailOtpType[];

/**
 * Where email login links and OAuth providers send people back: trade the one-time code for
 * a session (stored in cookies), then continue to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  const fail = (code: LoginErrorCode) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", code);
    if (next !== DEFAULT_AFTER_LOGIN) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  // The provider or Supabase already reported a problem (cancelled, expired link, ...).
  if (searchParams.has("error")) {
    return fail(toLoginErrorCode(searchParams.get("error_code"), searchParams.get("error")));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("failed");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  try {
    let result: { error: { code?: string } | null };
    if (code) {
      result = await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
      result = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    } else {
      return fail("failed");
    }
    if (result.error) return fail(toLoginErrorCode(result.error.code));
  } catch {
    return fail("failed");
  }

  return NextResponse.redirect(new URL(next, origin));
}
