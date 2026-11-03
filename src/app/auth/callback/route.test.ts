// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
};
const server = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/server/supabase", () => server);

const callback = (query: string) =>
  GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`));

const location = (response: Response) => response.headers.get("location");

describe("GET /auth/callback", () => {
  beforeEach(() => {
    auth.exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null });
    auth.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
    server.createSupabaseServerClient.mockReset().mockResolvedValue({ auth });
  });

  it("exchanges the code and continues to next", async () => {
    const response = await callback("code=abc&next=%2Fdemo");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(location(response)).toBe("http://localhost:3000/demo");
  });

  it("goes to the boards by default and never to another site", async () => {
    expect(location(await callback("code=abc"))).toBe("http://localhost:3000/boards");
    expect(location(await callback("code=abc&next=%2F%2Fevil.com"))).toBe(
      "http://localhost:3000/boards",
    );
  });

  it("verifies a token hash from a custom email template", async () => {
    const response = await callback("token_hash=h1&type=magiclink");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "h1" });
    expect(location(response)).toBe("http://localhost:3000/boards");
  });

  it("sends an expired link back to the login page", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "otp_expired" } });
    expect(location(await callback("code=old&next=%2Fdemo"))).toBe(
      "http://localhost:3000/login?error=expired&next=%2Fdemo",
    );
  });

  it("explains a link opened in another browser", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { code: "pkce_code_verifier_not_found" },
    });
    expect(location(await callback("code=abc"))).toBe("http://localhost:3000/login?error=browser");
  });

  it("passes on errors that Supabase reports in the URL", async () => {
    const response = await callback("error=access_denied&error_code=otp_expired");
    expect(location(response)).toBe("http://localhost:3000/login?error=expired");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    ["no code at all", ""],
    ["an unknown token type", "token_hash=h1&type=sms"],
  ])("fails with %s", async (_label, query) => {
    expect(location(await callback(query))).toBe("http://localhost:3000/login?error=failed");
  });

  it("fails when Supabase can't be reached", async () => {
    auth.exchangeCodeForSession.mockRejectedValue(new TypeError("fetch failed"));
    expect(location(await callback("code=abc"))).toBe("http://localhost:3000/login?error=failed");
  });

  it("fails when Supabase isn't configured", async () => {
    server.createSupabaseServerClient.mockResolvedValue(null);
    expect(location(await callback("code=abc"))).toBe("http://localhost:3000/login?error=failed");
  });
});
