import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFreeTries } from "@/hooks/use-free-tries";
import { QUOTA_ENDPOINT } from "@/lib/ai/client";
import { readPendingChunk, savePendingChunk } from "@/lib/ai/pending-chunk";
import { FREE_TRIES_HEADER, makeApiError } from "@/lib/ai/schemas";
import {
  createFakeSupabase,
  fakeUser,
  stubSupabaseEnv,
  type FakeSupabase,
} from "@/test/fake-supabase";
import { renderDemoBoard } from "@/test/render-board";

const BIG_CARD = "Build my portfolio website";
const SUBTASKS = [
  { title: "Pick a site template", estimateMinutes: 20, order: 1 },
  { title: "Write the about page", estimateMinutes: 60, order: 2 },
  { title: "Deploy to Vercel", estimateMinutes: 25, order: 3 },
];

let supabase: FakeSupabase | null = null;
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => supabase }));

/** Answers the quota check and chunk requests separately, in order. */
function stubApi({ quota = [] as Response[], chunk = [] as Response[] }) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const next = String(url) === QUOTA_ENDPOINT ? quota.shift() : chunk.shift();
    if (!next) throw new Error(`unexpected fetch ${String(url)}`);
    return next;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const chunked = (left?: number) =>
  Response.json(
    { subtasks: SUBTASKS, provider: "gemini" },
    { headers: left === undefined ? {} : { [FREE_TRIES_HEADER]: String(left) } },
  );

async function openChunk(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: `Actions for “${BIG_CARD}”` }));
  await user.click(await screen.findByRole("menuitem", { name: "Chunk it" }));
  return screen.findByRole("dialog", { name: "Chunk it" });
}

beforeEach(() => {
  localStorage.clear();
  resetFreeTries();
  stubSupabaseEnv();
});
afterEach(() => {
  supabase = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Chunk it for guests", () => {
  it("shows the free tries left and counts down after each chunk", async () => {
    supabase = createFakeSupabase(null);
    stubApi({ quota: [Response.json({ freeTriesLeft: 2 })], chunk: [chunked(1)] });
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openChunk(user);

    expect(await within(dialog).findByText("2 free tries left")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    expect(await within(dialog).findByText("1 free try left")).toBeInTheDocument();
  });

  it("asks to log in when the free tries are used up and remembers the chunk", async () => {
    supabase = createFakeSupabase(null);
    const message = "You've used your 3 free chunks. Log in free to keep going.";
    stubApi({
      quota: [Response.json({ freeTriesLeft: 0 })],
      chunk: [
        Response.json(makeApiError("LOGIN_REQUIRED", message), {
          status: 401,
          headers: { [FREE_TRIES_HEADER]: "0" },
        }),
      ],
    });
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openChunk(user);
    await user.click(within(dialog).getByRole("radio", { name: /Brief/ }));
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Log in to keep chunking");
    expect(alert).toHaveTextContent(message);
    expect(within(dialog).getByText("No free tries left")).toBeInTheDocument();
    const login = within(alert).getByRole("link", { name: "Log in to continue" });
    expect(login).toHaveAttribute("href", "/login");

    // jsdom can't navigate; stop the link after its own click handler ran.
    login.addEventListener("click", (e) => e.preventDefault());
    await user.click(login);
    expect(readPendingChunk()).toMatchObject({
      cardId: "demo-card-portfolio",
      cardTitle: BIG_CARD,
      detail: "brief",
      path: window.location.pathname,
    });

    await user.click(within(alert).getByRole("button", { name: "Add steps by hand" }));
    expect(within(dialog).getByRole("textbox", { name: "New subtask" })).toBeInTheDocument();
  });

  it("runs the remembered chunk again after logging in", async () => {
    supabase = createFakeSupabase(fakeUser());
    savePendingChunk({
      cardId: "demo-card-portfolio",
      cardTitle: BIG_CARD,
      detail: "detailed",
      path: window.location.pathname,
    });
    const fetch = stubApi({ chunk: [chunked()] });
    renderDemoBoard();

    const dialog = await screen.findByRole("dialog", { name: "Chunk it" });
    expect(
      await within(dialog).findByRole("list", { name: "Suggested subtasks" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Detailed/ })).toBeChecked();
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      title: BIG_CARD,
      detail: "detailed",
    });
    expect(readPendingChunk()).toBeNull();
    // Logged in: no badge, and the quota isn't asked for.
    expect(within(dialog).queryByText(/free tr/)).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url) === QUOTA_ENDPOINT)).toBe(false);
  });

  it("doesn't resume for a guest who hasn't logged in", async () => {
    supabase = createFakeSupabase(null);
    savePendingChunk({
      cardId: "demo-card-portfolio",
      cardTitle: BIG_CARD,
      detail: "medium",
      path: window.location.pathname,
    });
    stubApi({ quota: [Response.json({ freeTriesLeft: 0 })] });
    renderDemoBoard();

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog", { name: "Chunk it" })).not.toBeInTheDocument();
    expect(readPendingChunk()).not.toBeNull();
  });
});
