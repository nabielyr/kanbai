import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  fakeUser,
  stubSupabaseEnv,
  type FakeSupabase,
} from "@/test/fake-supabase";
import { LoginPanel } from "./login-panel";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => supabase }));

const emailInput = () => screen.getByLabelText("Email");
const sendButton = () => screen.getByRole("button", { name: "Email me a login link" });

describe("LoginPanel", () => {
  beforeEach(() => {
    stubSupabaseEnv();
    nav.search = "";
    supabase = createFakeSupabase(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("explains that login is off when Supabase isn't configured", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    render(<LoginPanel />);
    expect(screen.getByText(/Login isn't set up/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "try the demo" })).toHaveAttribute("href", "/demo");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("emails a login link that returns to next", async () => {
    const user = userEvent.setup();
    nav.search = "next=%2Fdemo";
    render(<LoginPanel />);

    await user.type(emailInput(), "  nabiel@example.com ");
    await user.click(sendButton());

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "nabiel@example.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fdemo" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "We sent a login link to nabiel@example.com",
    );

    await user.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(emailInput()).toBeInTheDocument();
  });

  it("checks the address before sending", async () => {
    const user = userEvent.setup();
    render(<LoginPanel />);

    await user.type(emailInput(), "not-an-email");
    await user.click(sendButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(emailInput()).toHaveAttribute("aria-invalid", "true");
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("asks to wait when Supabase's email limit is hit", async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    render(<LoginPanel />);

    await user.type(emailInput(), "nabiel@example.com");
    await user.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/Wait a few minutes/);
  });

  it("shows the error the callback sent back", () => {
    nav.search = "error=expired";
    render(<LoginPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent(/expired or was already used/);
  });

  it("lets a logged-in visitor continue", () => {
    nav.search = "next=%2Fdemo";
    supabase = createFakeSupabase(fakeUser());
    render(<LoginPanel />);
    expect(screen.getByText(/You're logged in as/)).toHaveTextContent("nabiel@example.com");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/demo");
  });
});
