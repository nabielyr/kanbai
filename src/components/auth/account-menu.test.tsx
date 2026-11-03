import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import {
  createFakeSupabase,
  fakeUser,
  stubSupabaseEnv,
  type FakeSupabase,
} from "@/test/fake-supabase";
import { AccountMenu } from "./account-menu";

const nav = vi.hoisted(() => ({ pathname: "/demo", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: nav.refresh }),
}));

let supabase: FakeSupabase | null = null;
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => supabase }));

describe("AccountMenu", () => {
  beforeEach(() => {
    stubSupabaseEnv();
    nav.pathname = "/demo";
    nav.refresh.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders nothing when Supabase isn't configured", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    supabase = createFakeSupabase();
    const { container } = render(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers to log in and come back to the current page", () => {
    supabase = createFakeSupabase(null);
    render(<AccountMenu />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fdemo",
    );
  });

  it("hides the Log in button on the login page", () => {
    nav.pathname = "/login";
    supabase = createFakeSupabase(null);
    render(<AccountMenu />);
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("shows the user's initials and logs out from the menu", async () => {
    const user = userEvent.setup();
    supabase = createFakeSupabase(fakeUser({ user_metadata: { full_name: "Nabiel Yandra" } }));
    render(
      <>
        <AccountMenu />
        <Toaster />
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Account menu for Nabiel Yandra" });
    expect(trigger).toHaveTextContent("NY");

    await user.click(trigger);
    expect(screen.getByText("nabiel@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(await screen.findByText("Logged out")).toBeInTheDocument();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("says so when logging out fails", async () => {
    const user = userEvent.setup();
    supabase = createFakeSupabase(fakeUser());
    supabase.auth.signOut.mockResolvedValue({ error: new Error("offline") });
    render(
      <>
        <AccountMenu />
        <Toaster />
      </>,
    );

    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(await screen.findByText("Couldn't log out. Please try again.")).toBeInTheDocument();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
