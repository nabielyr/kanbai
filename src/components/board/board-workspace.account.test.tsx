import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageKey } from "@/lib/storage/local-storage-adapter";
import { createWorkspaceState } from "@/lib/storage/workspace-seed";
import { createBoardStore } from "@/store/board-store";
import { createFakeBoardsDb, type FakeBoardsDb } from "@/test/fake-boards-db";
import { createFakeSupabase, fakeUser, stubSupabaseEnv } from "@/test/fake-supabase";
import { BoardWorkspace } from "./board-workspace";

vi.mock("next/navigation", () => ({
  usePathname: () => "/boards",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

let db: FakeBoardsDb;
let signedIn: User | null;
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    ...createFakeSupabase(signedIn),
    from: db.clientFor(signedIn?.id ?? "nobody").from,
  }),
}));

const createInitialData = () => createWorkspaceState(new Date(2026, 10, 5));

function renderWorkspace() {
  return render(
    <>
      <BoardWorkspace namespace="workspace" createInitialData={createInitialData} />
      <Toaster />
    </>,
  );
}

async function createBoard(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Switch board" }));
  await user.click(await screen.findByRole("menuitem", { name: "New board" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByRole("textbox", { name: "Board name" }), name);
  await user.click(within(dialog).getByRole("button", { name: "Create board" }));
}

beforeEach(() => {
  db = createFakeBoardsDb();
  localStorage.clear();
  stubSupabaseEnv();
});
afterEach(() => vi.unstubAllEnvs());

describe("BoardWorkspace with an account", () => {
  it("saves a signed-in user's boards to their account and shows Saved", async () => {
    signedIn = fakeUser({ id: "user-a" });
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My first board");
    expect(screen.getByText("Saved")).toBeInTheDocument();

    await createBoard(user, "Thesis");
    await waitFor(() =>
      expect(db.rowsOf("user-a").map((r) => r.title)).toEqual(["My first board", "Thesis"]),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(localStorage.getItem(storageKey("workspace"))).toBeNull(); // not in guest storage
  });

  it("loads the boards already in the account", async () => {
    signedIn = fakeUser({ id: "user-a" });
    const first = renderWorkspace();
    const user = userEvent.setup();
    await screen.findByRole("heading", { level: 1 });
    await createBoard(user, "Thesis");
    await waitFor(() => expect(db.rowsOf("user-a")).toHaveLength(2));
    first.unmount();

    localStorage.clear(); // another browser
    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My first board");
    await user.click(screen.getByRole("button", { name: "Switch board" }));
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["My first board", "Thesis"]);
  });

  it("shows a retry screen when the account can't be reached", async () => {
    signedIn = fakeUser({ id: "user-a" });
    db.failNext(1);
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load your boards");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My first board");
  });

  it("keeps guests' boards in this browser, with no sync status", async () => {
    signedIn = null;
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/^(Saved|Saving…)$/)).not.toBeInTheDocument();

    await createBoard(user, "Thesis");
    await waitFor(() => expect(localStorage.getItem(storageKey("workspace"))).toContain("Thesis"));
    expect(db.rows).toHaveLength(0);
  });
});

describe("importing guest boards on login", () => {
  /** What a guest left in this browser: the starter board (touched) plus "Thesis". */
  function leaveGuestBoards() {
    const store = createBoardStore(createWorkspaceState(new Date(2026, 10, 1)));
    store.getState().actions.createBoard("Thesis");
    localStorage.setItem(storageKey("workspace"), JSON.stringify(store.getState().data));
  }

  const accountTitles = () => db.rowsOf("user-a").map((r) => r.title);

  beforeEach(() => {
    signedIn = fakeUser({ id: "user-a" });
  });

  it("imports them into a new account, replacing the untouched starter board", async () => {
    leaveGuestBoards();
    const user = userEvent.setup();
    renderWorkspace();

    const dialog = await screen.findByRole("dialog", { name: "Import your 2 guest boards?" });
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["My first board", "Thesis"]);
    await user.click(within(dialog).getByRole("button", { name: "Import 2 boards" }));

    expect(await screen.findByText("Imported 2 boards to your account.")).toBeInTheDocument();
    expect(accountTitles()).toEqual(["My first board", "Thesis"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My first board");
    expect(localStorage.getItem(storageKey("workspace"))).toBeNull();
  });

  it("adds them after the boards already in the account", async () => {
    const user = userEvent.setup();
    const first = renderWorkspace();
    await screen.findByRole("heading", { level: 1 });
    await createBoard(user, "Work");
    await waitFor(() => expect(accountTitles()).toEqual(["My first board", "Work"]));
    first.unmount();

    leaveGuestBoards();
    renderWorkspace();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Import 2 boards" }));
    await waitFor(() =>
      expect(accountTitles()).toEqual(["My first board", "Work", "My first board", "Thesis"]),
    );
  });

  it("keeps the guest copy and says so when the import can't be saved yet", async () => {
    leaveGuestBoards();
    const user = userEvent.setup();
    renderWorkspace();
    const dialog = await screen.findByRole("dialog");
    db.failNext(2);
    await user.click(within(dialog).getByRole("button", { name: "Import 2 boards" }));

    expect(await screen.findByText("Imported 2 boards.")).toBeInTheDocument();
    expect(localStorage.getItem(storageKey("workspace"))).toContain("Thesis");
  });

  it("Skip leaves them in this browser and doesn't ask again", async () => {
    leaveGuestBoards();
    const user = userEvent.setup();
    const first = renderWorkspace();
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(storageKey("workspace"))).toContain("Thesis");
    first.unmount();

    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My first board");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(db.rows).toHaveLength(0);
  });

  it("asks again next time when closed without choosing", async () => {
    leaveGuestBoards();
    const user = userEvent.setup();
    const first = renderWorkspace();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    renderWorkspace();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("doesn't ask when the guest never changed the starter board", async () => {
    localStorage.setItem(
      storageKey("workspace"),
      JSON.stringify(createWorkspaceState(new Date(2026, 10, 1))),
    );
    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
