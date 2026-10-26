import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

const cardButton = (title: string) => screen.getByRole("button", { name: title });
// While the modal is open, Radix hides the board from assistive tech, so allow hidden nodes.
const tile = (title: string) =>
  screen.getByRole("button", { name: title, hidden: true }).querySelector("article")!;

async function openByClick(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(tile(title)).getByRole("heading", { name: title }));
  return screen.findByRole("dialog");
}

describe("card detail dialog", () => {
  it("opens when a card is clicked and shows its details", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openByClick(user, "Fix contact form on mobile");

    expect(within(dialog).getByRole("textbox", { name: "Card title" })).toHaveValue(
      "Fix contact form on mobile",
    );
    expect(within(dialog).getByRole("textbox", { name: "Description" })).toHaveValue(
      "The submit button is hidden behind the keyboard on small screens.",
    );
    expect(within(dialog).getByRole("radio", { name: "Urgent" })).toBeChecked();
    expect(dialog).toHaveTextContent("in To Do");
  });

  it("opens with Enter on a focused card", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    cardButton("Buy a domain name").focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText(/Picked up/)).not.toBeInTheDocument();
  });

  it("does not open when the card's menu button is clicked", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    await user.click(screen.getByRole("button", { name: "Actions for “Buy a domain name”" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves the description when the dialog is closed with Escape", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openByClick(user, "Buy a domain name");

    await user.type(within(dialog).getByRole("textbox", { name: "Description" }), "kanbai.dev?");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(data().cards["demo-card-domain"].description).toBe("kanbai.dev?");
    expect(within(tile("Buy a domain name")).getByText("kanbai.dev?")).toBeInTheDocument();
  });

  it("saves the title on Enter and keeps the old title if cleared", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openByClick(user, "Buy a domain name");
    const title = within(dialog).getByRole("textbox", { name: "Card title" });

    await user.clear(title);
    await user.type(title, "Buy kanbai.dev{Enter}");
    expect(data().cards["demo-card-domain"].title).toBe("Buy kanbai.dev");

    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue("Buy kanbai.dev");
    expect(data().cards["demo-card-domain"].title).toBe("Buy kanbai.dev");
  });

  it("changes priority immediately and updates the tile", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openByClick(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("radio", { name: "High" }));

    expect(data().cards["demo-card-domain"].priority).toBe("high");
    expect(within(tile("Buy a domain name")).getByText("High")).toBeInTheDocument();
  });

  it("deletes the card from the dialog, with Undo", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openByClick(user, "Buy a domain name");

    await user.click(within(dialog).getByRole("button", { name: "Delete card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(data().cards["demo-card-domain"]).toBeUndefined();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(data().cards["demo-card-domain"]).toBeDefined();
  });
});
