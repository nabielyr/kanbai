import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { renderDemoBoard } from "@/test/render-board";

// While the modal is open, Radix hides the board from assistive tech, so allow hidden nodes.
const tile = (title: string) =>
  screen.getByRole("button", { name: title, hidden: true }).querySelector("article")!;
const tileLabels = (title: string) =>
  within(tile(title))
    .queryAllByRole("listitem", { hidden: true })
    .map((li) => li.textContent);

async function openCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(tile(title)).getByRole("heading", { name: title }));
  return screen.findByRole("dialog");
}

describe("card labels", () => {
  it("shows the board's labels with the card's labels pressed", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    expect(within(dialog).getByRole("button", { name: "research" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "bug" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles labels on the card and updates the tile", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "bug" }));
    await user.click(within(dialog).getByRole("button", { name: "research" }));

    expect(data().cards["demo-card-domain"].labelIds).toEqual(["demo-label-bug"]);
    expect(tileLabels("Buy a domain name")).toEqual(["bug"]);
  });

  it("creates a label from the dialog and applies it to the card", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    await user.type(
      within(dialog).getByRole("textbox", { name: "New label name" }),
      "admin{Enter}",
    );

    const labels = data().boards[DEMO_BOARD_ID].labels;
    expect(labels.at(-1)).toMatchObject({ name: "admin" });
    expect(labels.at(-1)!.color).not.toBe(labels[0].color); // suggests an unused color
    expect(data().cards["demo-card-domain"].labelIds).toContain(labels.at(-1)!.id);
    expect(within(dialog).getByRole("textbox", { name: "New label name" })).toHaveValue("");
  });

  it("rejects a duplicate label name", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");
    const count = data().boards[DEMO_BOARD_ID].labels.length;

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    await user.type(within(dialog).getByRole("textbox", { name: "New label name" }), "BUG{Enter}");

    expect(within(dialog).getByText("A label with this name already exists.")).toBeInTheDocument();
    expect(data().boards[DEMO_BOARD_ID].labels).toHaveLength(count);
  });

  it("renames and recolors a label everywhere", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    const name = within(dialog).getByRole("textbox", { name: "Name of label “research”" });
    await user.clear(name);
    await user.type(name, "explore{Enter}");

    await user.click(within(dialog).getByRole("button", { name: /^Color of label “explore”/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Slate" }));

    const label = data().boards[DEMO_BOARD_ID].labels.find((l) => l.id === "demo-label-research");
    expect(label).toEqual({ id: "demo-label-research", name: "explore", color: "slate" });
    expect(tileLabels("Compare free hosting options")).toEqual(["explore"]);
  });

  it("keeps the old name when a rename is blank or taken", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    const name = within(dialog).getByRole("textbox", { name: "Name of label “research”" });
    await user.clear(name);
    await user.type(name, "bug{Enter}");
    expect(within(dialog).getByText("Another label already has this name.")).toBeInTheDocument();

    await user.clear(name);
    await user.tab();
    expect(name).toHaveValue("research");
    expect(
      data().boards[DEMO_BOARD_ID].labels.find((l) => l.id === "demo-label-research")?.name,
    ).toBe("research");
  });

  it("asks before deleting a label that cards use, then removes it from them", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete label “research”" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("removed from 2 cards");
    await user.click(within(confirm).getByRole("button", { name: "Delete label" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(data().boards[DEMO_BOARD_ID].labels.some((l) => l.id === "demo-label-research")).toBe(
      false,
    );
    expect(data().cards["demo-card-domain"].labelIds).toEqual([]);
    expect(findIntegrityIssues(data())).toEqual([]);
    // The card dialog stays open after the confirmation closes.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("deletes an unused label without asking", async () => {
    const user = userEvent.setup();
    const { data, store } = renderDemoBoard();
    const id = store.getState().actions.addLabel(DEMO_BOARD_ID, "spare", "sage")!;
    const dialog = await openCard(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Edit labels" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete label “spare”" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(data().boards[DEMO_BOARD_ID].labels.some((l) => l.id === id)).toBe(false);
  });
});
