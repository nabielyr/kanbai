import { describe, expect, it } from "vitest";
import { getUserDisplay } from "./user-display";

describe("getUserDisplay", () => {
  it("uses the full name from the provider", () => {
    expect(
      getUserDisplay({
        email: "nabiel@example.com",
        user_metadata: { full_name: "Nabiel Yandra" },
      }),
    ).toEqual({
      name: "Nabiel Yandra",
      email: "nabiel@example.com",
      initials: "NY",
      avatarUrl: null,
    });
  });

  it("falls back to the GitHub username, then the email", () => {
    expect(getUserDisplay({ email: "a@b.co", user_metadata: { user_name: "nabielyr" } }).name).toBe(
      "nabielyr",
    );
    expect(getUserDisplay({ email: "nabiel.yandra@example.com", user_metadata: {} })).toEqual({
      name: "nabiel.yandra",
      email: "nabiel.yandra@example.com",
      initials: "NY",
      avatarUrl: null,
    });
  });

  it("ignores blank metadata", () => {
    expect(getUserDisplay({ email: "sam@x.io", user_metadata: { full_name: "  " } }).name).toBe(
      "sam",
    );
  });

  it("still has something to show without a name or email", () => {
    expect(getUserDisplay({ email: undefined, user_metadata: {} })).toEqual({
      name: "Account",
      email: null,
      initials: "A",
      avatarUrl: null,
    });
  });

  it("uses the provider's photo (GitHub avatar_url, Google picture)", () => {
    const github = "https://avatars.githubusercontent.com/u/1?v=4";
    const google = "https://lh3.googleusercontent.com/a/photo";
    expect(
      getUserDisplay({ email: "a@b.co", user_metadata: { avatar_url: github } }).avatarUrl,
    ).toBe(github);
    expect(getUserDisplay({ email: "a@b.co", user_metadata: { picture: google } }).avatarUrl).toBe(
      google,
    );
  });

  it("ignores photos that aren't https", () => {
    expect(
      getUserDisplay({ email: "a@b.co", user_metadata: { avatar_url: "javascript:alert(1)" } })
        .avatarUrl,
    ).toBeNull();
    expect(
      getUserDisplay({ email: "a@b.co", user_metadata: { avatar_url: "http://x.io/a.png" } })
        .avatarUrl,
    ).toBeNull();
  });
});
