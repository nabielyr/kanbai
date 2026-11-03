import { describe, expect, it } from "vitest";
import { getEmailLinkErrorMessage, getLoginErrorMessage, toLoginErrorCode } from "./login-errors";

describe("getLoginErrorMessage", () => {
  it("has nothing to say without an error", () => {
    expect(getLoginErrorMessage(null)).toBeNull();
    expect(getLoginErrorMessage("")).toBeNull();
  });

  it("explains each known error", () => {
    expect(getLoginErrorMessage("expired")).toMatch(/expired/);
    expect(getLoginErrorMessage("browser")).toMatch(/same browser/);
    expect(getLoginErrorMessage("denied")).toMatch(/cancelled/);
  });

  it("treats unknown codes as a generic failure", () => {
    expect(getLoginErrorMessage("<script>")).toBe(getLoginErrorMessage("failed"));
  });
});

describe("toLoginErrorCode", () => {
  it.each([
    ["otp_expired", "access_denied", "expired"],
    ["flow_state_expired", null, "expired"],
    ["pkce_code_verifier_not_found", null, "browser"],
    ["bad_code_verifier", null, "browser"],
    [null, "access_denied", "denied"],
    ["unexpected_failure", null, "failed"],
    [null, null, "failed"],
  ])("maps %s / %s to %s", (code, error, expected) => {
    expect(toLoginErrorCode(code, error)).toBe(expected);
  });
});

describe("getEmailLinkErrorMessage", () => {
  it("asks to wait when Supabase's email limit is hit", () => {
    expect(getEmailLinkErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/Wait/);
    expect(getEmailLinkErrorMessage({ status: 429 })).toMatch(/Wait/);
  });

  it("flags an invalid address", () => {
    expect(getEmailLinkErrorMessage({ code: "email_address_invalid" })).toBe(
      "Enter a valid email address.",
    );
  });

  it("falls back to a generic message", () => {
    expect(getEmailLinkErrorMessage({ status: 500 })).toMatch(/couldn't send/);
  });
});
