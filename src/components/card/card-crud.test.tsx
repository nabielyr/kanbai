import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

const column = (name: string) => screen.getByRole("region", { name });
const cardTitles = (name: string) =>
  within(column(name))
    .getAllByRole("article")
    .map((a) => within(a).getByRole("heading").textContent);

describe("card CRUD", () => {
  it("adds several cards in a row with Enter, then closes with Escape", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(within(column("Done")).getByRole("button", { name: "Add card" }));
    const input = screen.getByRole("textbox", { name: "New card title in Done" });
    await user.type(input, "Ship it{Enter}");
    await user.type(input, "Celebrate{Enter}");
    await user.keyboard("{Escape}");

    expect(cardTitles("Done").slice(-2)).toEqual(["Ship it", "Celebrate"]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(data().columns["demo-col-done"].cardIds).toHaveLength(4);
  });

  it("does not add a card with an empty title", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    await user.click(within(column("Done")).getByRole("button", { name: "Add card" }));
    await user.keyboard("   {Enter}");
    expect(data().columns["demo-col-done"].cardIds).toHaveLength(2);
  });

  it("edits a card title from the card menu", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Actions for “Buy a domain name”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit title" }));
    const input = screen.getByRole("textbox", { name: "Card title" });
    expect(input).toHaveValue("Buy a domain name");
    await user.clear(input);
    await user.type(input, "Buy kanbai.dev{Enter}");

    expect(data().cards["demo-card-domain"].title).toBe("Buy kanbai.dev");
    expect(screen.getByRole("heading", { name: "Buy kanbai.dev" })).toBeInTheDocument();
  });

  it("cancels a title edit with Escape", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    await user.click(screen.getByRole("button", { name: "Actions for “Buy a domain name”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit title" }));
    await user.type(screen.getByRole("textbox", { name: "Card title" }), " nope{Escape}");
    expect(data().cards["demo-card-domain"].title).toBe("Buy a domain name");
  });

  it("deletes a card and restores it with Undo", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const before = cardTitles("To Do");

    await user.click(
      screen.getByRole("button", { name: "Actions for “Write a case study for KanbAI”" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete card" }));

    expect(data().cards["demo-card-case-study"]).toBeUndefined();
    expect(cardTitles("To Do")).not.toContain("Write a case study for KanbAI");

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(cardTitles("To Do")).toEqual(before));
  });
});
