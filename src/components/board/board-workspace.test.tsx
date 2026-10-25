import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceState } from "@/lib/storage/workspace-seed";
import { BoardWorkspace } from "./board-workspace";

const createInitialData = () => createWorkspaceState(new Date(2026, 9, 25));

function renderWorkspace() {
  return render(
    <>
      <BoardWorkspace namespace="workspace" createInitialData={createInitialData} />
      <Toaster />
    </>,
  );
}

const boardHeading = () => screen.getByRole("heading", { level: 1 });

async function createBoard(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Switch board" }));
  await user.click(await screen.findByRole("menuitem", { name: "New board" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByRole("textbox", { name: "Board name" }), name);
  await user.click(within(dialog).getByRole("button", { name: "Create board" }));
}

beforeEach(() => localStorage.clear());

describe("BoardWorkspace (multiple boards)", () => {
  it("starts a new visitor on “My first board” with a welcome card", async () => {
    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My first board");
    expect(screen.getByText("👋 Drag this card to In Progress")).toBeInTheDocument();
  });

  it("creates a board, makes it active, and lists both in the switcher", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole("heading", { level: 1 });

    await createBoard(user, "Thesis");

    expect(boardHeading()).toHaveTextContent("Thesis");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch board" }));
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["My first board", "Thesis"]);
    expect(items[1]).toHaveAttribute("aria-checked", "true");

    await user.click(items[0]);
    expect(boardHeading()).toHaveTextContent("My first board");
  });

  it("does not create a board without a name", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: "Switch board" }));
    await user.click(await screen.findByRole("menuitem", { name: "New board" }));
    expect(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Create board" }),
    ).toBeDisabled();
  });

  it("renames the board by clicking its title", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: "My first board" }));
    const input = screen.getByRole("textbox", { name: "Board name" });
    await user.clear(input);
    await user.type(input, "Life admin{Enter}");
    expect(boardHeading()).toHaveTextContent("Life admin");
  });

  it("deletes a board after confirming and switches to another one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole("heading", { level: 1 });
    await createBoard(user, "Temp");

    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete board" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete “Temp”?");
    await user.click(within(dialog).getByRole("button", { name: "Delete board" }));

    expect(boardHeading()).toHaveTextContent("My first board");
  });

  it("shows an empty state after deleting the last board, and can create a new one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete board" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete board" }),
    );

    expect(boardHeading()).toHaveTextContent("No boards yet");
    await user.click(screen.getByRole("button", { name: "Create a board" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Board name" }), "Fresh start");
    await user.keyboard("{Enter}");

    expect(boardHeading()).toHaveTextContent("Fresh start");
  });

  it("keeps boards after a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWorkspace();
    await screen.findByRole("heading", { level: 1 });
    await createBoard(user, "Saved board");
    unmount(); // flushes the pending autosave

    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Saved board");
  });
});
