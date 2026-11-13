// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { identifyCaller } from "./caller";

const server = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("./supabase", () => server);

const withClaims = (getClaims: () => Promise<unknown>) =>
  server.createSupabaseServerClient.mockResolvedValue({ auth: { getClaims } });

describe("identifyCaller", () => {
  beforeEach(() => server.createSupabaseServerClient.mockReset());

  it("is no-login when Supabase isn't configured", async () => {
    server.createSupabaseServerClient.mockResolvedValue(null);
    expect(await identifyCaller()).toEqual({ kind: "no-login" });
  });

  it("is the user when the session token verifies", async () => {
    withClaims(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));
    expect(await identifyCaller()).toEqual({ kind: "user", userId: "user-1" });
  });

  it.each([
    ["no session", async () => ({ data: null, error: null })],
    ["an invalid token", async () => ({ data: null, error: new Error("bad jwt") })],
    ["claims without a subject", async () => ({ data: { claims: {} }, error: null })],
    ["an empty subject", async () => ({ data: { claims: { sub: "" } }, error: null })],
    [
      "a lookup that throws",
      async () => {
        throw new Error("network");
      },
    ],
  ])("is a guest with %s", async (_, getClaims) => {
    withClaims(getClaims);
    expect(await identifyCaller()).toEqual({ kind: "guest" });
  });
});
