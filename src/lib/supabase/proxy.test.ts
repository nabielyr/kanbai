// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";

type SetAll = (
  cookies: { name: string; value: string; options: Record<string, unknown> }[],
  headers: Record<string, string>,
) => void;

const ssr = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ssr);

const request = () =>
  new NextRequest("http://localhost:3000/boards", { headers: { cookie: "sb-old=1" } });

describe("updateSession", () => {
  beforeEach(() => ssr.createServerClient.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("passes the request through when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const response = await updateSession(request());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(ssr.createServerClient).not.toHaveBeenCalled();
  });

  describe("with Supabase configured", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    });

    it("refreshes the session and writes the new cookies and no-cache headers", async () => {
      ssr.createServerClient.mockImplementation(
        (_url: string, _key: string, options: { cookies: { setAll: SetAll } }) => ({
          auth: {
            getClaims: vi.fn(async () => {
              options.cookies.setAll(
                [{ name: "sb-token", value: "fresh", options: { path: "/" } }],
                { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" },
              );
              return { data: null, error: null };
            }),
          },
        }),
      );

      const response = await updateSession(request());

      expect(ssr.createServerClient).toHaveBeenCalledWith(
        "https://abc.supabase.co",
        "anon",
        expect.anything(),
      );
      expect(response.cookies.get("sb-token")?.value).toBe("fresh");
      expect(response.headers.get("cache-control")).toContain("no-store");
    });

    it("hands the request cookies to Supabase", async () => {
      let seen: unknown;
      ssr.createServerClient.mockImplementation(
        (_url: string, _key: string, options: { cookies: { getAll: () => unknown } }) => ({
          auth: {
            getClaims: vi.fn(async () => {
              seen = options.cookies.getAll();
              return { data: null, error: null };
            }),
          },
        }),
      );
      await updateSession(request());
      expect(seen).toEqual([{ name: "sb-old", value: "1" }]);
    });

    it("still serves the page when Supabase can't be reached", async () => {
      ssr.createServerClient.mockReturnValue({
        auth: { getClaims: vi.fn().mockRejectedValue(new TypeError("fetch failed")) },
      });
      const response = await updateSession(request());
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });
});
