import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { THEME_KEY } from "@/lib/theme";
import { renderDemoBoard } from "@/test/render-board";

const column = (name: string) => screen.getByRole("region", { name });
const search = () => screen.getByRole("searchbox", { name: "Search cards" });

afterEach(() => {
  localStorage.removeItem(THEME_KEY);
  document.documentElement.className = "";
});

describe("keyboard shortcuts", () => {
  it("? opens the shortcut list, Escape closes it", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.keyboard("?");
    const help = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(help).getByText("Search cards")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("the keyboard button opens the same list", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  it("/ jumps to search without typing a slash", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.keyboard("/");
    expect(search()).toHaveFocus();
    expect(search()).toHaveValue("");
  });

  it("N adds a card to the first column, or to the one under the pointer", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.keyboard("n");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "New card title in To Do" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");

    await user.hover(column("In Progress"));
    await user.keyboard("n");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "New card title in In Progress" })).toHaveFocus(),
    );
  });

  it("does nothing while you type in a field", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.type(search(), "n/t?");
    expect(search()).toHaveValue("n/t?");
    expect(screen.queryByRole("textbox", { name: /New card title/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("C chunks the card whose dialog is open", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.click(screen.getByRole("heading", { name: "Build my portfolio website" }));
    await screen.findByRole("dialog");
    await user.keyboard("c");
    const dialog = await screen.findByRole("dialog", { name: "Chunk it" });
    expect(within(dialog).getByText(/Build my portfolio website/)).toBeInTheDocument();
  });

  it("C on a focused card opens Chunk it for that card", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    screen.getByRole("button", { name: "Compare free hosting options" }).focus();
    await user.keyboard("c");
    const dialog = await screen.findByRole("dialog", { name: "Chunk it" });
    expect(within(dialog).getByText(/Compare free hosting options/)).toBeInTheDocument();
  });

  it("T switches between light and dark", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.keyboard("t");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    await user.keyboard("t");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("empty states", () => {
  it("an empty column shows where cards go", () => {
    const { store } = renderDemoBoard();
    act(() => {
      store.getState().actions.addColumn(DEMO_BOARD_ID, "Later");
    });
    expect(
      within(column("Later")).getByText("Nothing here yet. Add a card or drag one in."),
    ).toBeInTheDocument();
  });
});
