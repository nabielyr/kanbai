import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, isAuthConfigured, readSupabaseConfig } from "./config";

describe("readSupabaseConfig", () => {
  it("returns the trimmed URL (without a trailing slash) and key", () => {
    expect(readSupabaseConfig(" https://abc.supabase.co/ ", " sb_publishable_123 ")).toEqual({
      url: "https://abc.supabase.co",
      key: "sb_publishable_123",
    });
  });

  it.each([
    ["missing URL", undefined, "key"],
    ["missing key", "https://abc.supabase.co", undefined],
    ["empty values", "", "  "],
    ["not a URL", "abc.supabase.co", "key"],
    ["wrong protocol", "ftp://abc.supabase.co", "key"],
  ])("is null with %s", (_label, url, key) => {
    expect(readSupabaseConfig(url, key)).toBeNull();
  });
});

describe("getSupabaseConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the public env vars", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(getSupabaseConfig()).toEqual({ url: "https://abc.supabase.co", key: "anon" });
    expect(isAuthConfigured()).toBe(true);
  });

  it("switches auth off when they're empty", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabaseConfig()).toBeNull();
    expect(isAuthConfigured()).toBe(false);
  });
});
