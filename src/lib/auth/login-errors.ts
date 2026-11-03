/** Error codes the auth callback puts on `/login?error=…`. */
export type LoginErrorCode = "denied" | "expired" | "browser" | "failed";

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  denied: "Login was cancelled. You can try again or pick another way to log in.",
  expired: "That login link has expired or was already used. Ask for a new one below.",
  browser: "Open the login link in the same browser where you asked for it.",
  failed: "We couldn't log you in. Please try again.",
};

export function getLoginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return LOGIN_ERROR_MESSAGES[code as LoginErrorCode] ?? LOGIN_ERROR_MESSAGES.failed;
}

/** Supabase's error codes (on the callback URL or from the code exchange) → ours. */
export function toLoginErrorCode(
  code: string | null | undefined,
  error?: string | null,
): LoginErrorCode {
  switch (code) {
    case "otp_expired":
    case "flow_state_expired":
      return "expired";
    case "pkce_code_verifier_not_found":
    case "bad_code_verifier":
      return "browser";
  }
  return error === "access_denied" ? "denied" : "failed";
}

interface AuthErrorLike {
  code?: string;
  status?: number;
}

/** What to show when asking for an email link fails. */
export function getEmailLinkErrorMessage(error: AuthErrorLike): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Too many login emails were sent. Wait a few minutes and try again.";
  }
  if (error.code === "email_address_invalid") return "Enter a valid email address.";
  return "We couldn't send the link. Please try again.";
}
