import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

// While the modal is open, Radix hides the board from assistive tech, so allow hidden nodes.
const tile = (title: string) =>
  screen.getByRole("button", { name: title, hidden: true }).querySelector("article")!;
const tileProgress = (title: string) =>
  within(tile(title)).queryByRole("progressbar", { hidden: true });

async function openCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(tile(title)).getByRole("heading", { name: title }));
  return screen.findByRole("dialog");
}

const CASE_STUDY = "Write a case study for KanbAI";
const itemTitles = (data: () => ReturnType<ReturnType<typeof renderDemoBoard>["data"]>) =>
  data().cards["demo-card-case-study"].checklist.map((i) => i.title);

describe("card checklist", () => {
  it("shows items and progress", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openCard(user, CASE_STUDY);

    expect(within(dialog).getByText("1/3 done")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Outline the sections" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Take screenshots" })).not.toBeChecked();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("toggles an item and updates the tile progress live", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, CASE_STUDY);

    await user.click(within(dialog).getByRole("checkbox", { name: "Take screenshots" }));

    expect(data().cards["demo-card-case-study"].checklist[1].done).toBe(true);
    expect(within(dialog).getByText("2/3 done")).toBeInTheDocument();
    expect(tileProgress(CASE_STUDY)).toHaveAttribute("aria-valuenow", "2");
  });

  it("adds several items in a row", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Compare free hosting options");
    const input = within(dialog).getByRole("textbox", { name: "New checklist item" });

    expect(tileProgress("Compare free hosting options")).toBeNull();
    await user.type(input, "Vercel{Enter}");
    await user.type(input, "Netlify{Enter}");
    await user.type(input, "   {Enter}");

    expect(data().cards["demo-card-hosting"].checklist.map((i) => i.title)).toEqual([
      "Vercel",
      "Netlify",
    ]);
    expect(input).toHaveValue("   ");
    expect(input).toHaveFocus();
    expect(tileProgress("Compare free hosting options")).toHaveAttribute("aria-valuemax", "2");
  });

  it("edits an item's title, and Escape cancels without closing the dialog", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, CASE_STUDY);

    await user.click(within(dialog).getByRole("button", { name: "Take screenshots" }));
    const editor = within(dialog).getByRole("textbox", { name: "Checklist item" });
    await user.clear(editor);
    await user.type(editor, "Record a demo GIF{Enter}");
    expect(itemTitles(data)[1]).toBe("Record a demo GIF");

    await user.click(within(dialog).getByRole("button", { name: "Record a demo GIF" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Checklist item" }), " nope");
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox", { name: "Checklist item" })).toBeNull();
    expect(itemTitles(data)[1]).toBe("Record a demo GIF");
  });

  it("deletes an item", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, CASE_STUDY);

    await user.click(within(dialog).getByRole("button", { name: "Delete “Take screenshots”" }));

    expect(itemTitles(data)).toEqual(["Outline the sections", "Write the first draft"]);
    expect(within(dialog).getByText("1/2 done")).toBeInTheDocument();
  });

  it("reorders items with the arrow keys on the grip and keeps focus there", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, CASE_STUDY);

    const grip = within(dialog).getByRole("button", { name: "Reorder “Outline the sections”" });
    grip.focus();
    await user.keyboard("{ArrowDown}");
    expect(itemTitles(data)).toEqual([
      "Take screenshots",
      "Outline the sections",
      "Write the first draft",
    ]);
    expect(
      within(dialog).getByText(/Moved “Outline the sections” to position 2 of 3/),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{ArrowDown}"); // the second press is past the end
    expect(itemTitles(data).at(-1)).toBe("Outline the sections");

    await user.keyboard("{ArrowUp}");
    expect(itemTitles(data)[1]).toBe("Outline the sections");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Reorder “Outline the sections”" }),
      ).toHaveFocus(),
    );
  });
});
