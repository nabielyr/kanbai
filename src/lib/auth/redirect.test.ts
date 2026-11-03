import { describe, expect, it } from "vitest";
import { authCallbackUrl, DEFAULT_AFTER_LOGIN, loginPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/boards", "/boards"],
    ["/demo?x=1#top", "/demo?x=1#top"],
    ["/", "/"],
  ])("keeps the site path %s", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    ["nothing", null],
    ["an empty string", ""],
    ["another site", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["a backslash trick", "/\\evil.com"],
    ["a relative path", "boards"],
    ["the login page", "/login?next=/boards"],
    ["the auth callback", "/auth/callback?code=1"],
  ])("falls back for %s", (_label, value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.com", "/demo")).toBe("/demo");
  });
});

describe("authCallbackUrl", () => {
  it("points at the callback with a safe next path", () => {
    expect(authCallbackUrl("http://localhost:3000", "/demo")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fdemo",
    );
    expect(authCallbackUrl("https://kanbai.app", "https://evil.com")).toBe(
      "https://kanbai.app/auth/callback?next=%2Fboards",
    );
  });
});

describe("loginPath", () => {
  it("leaves out next when it's the default", () => {
    expect(loginPath("/boards")).toBe("/login");
    expect(loginPath(null)).toBe("/login");
  });

  it("returns to the current page", () => {
    expect(loginPath("/demo")).toBe("/login?next=%2Fdemo");
  });
});
