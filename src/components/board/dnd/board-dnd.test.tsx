import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

// Real pointer drags need layout, which jsdom doesn't have; the drop maths is covered by
// lib/domain/drag.test.ts. Here we check the wiring: draggables, keyboard sensor, guards.

const card = (title: string) =>
  screen.getByRole("button", { name: title, description: /pick up a card/i });

describe("board drag and drop wiring", () => {
  it("exposes every card as a keyboard-accessible draggable", () => {
    renderDemoBoard();
    const hero = card("Design the landing page hero");
    expect(hero).toHaveAttribute("aria-roledescription", "draggable card");
    expect(hero).toHaveAttribute("tabindex", "0");
  });

  it("picks up a focused card with Space and cancels with Escape", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const before = data();

    card("Buy a domain name").focus();
    await user.keyboard(" ");
    expect(await screen.findByText(/Picked up card “Buy a domain name”/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      await screen.findByText(/Cancelled\. Card “Buy a domain name” was put back/),
    ).toBeInTheDocument();
    expect(data()).toBe(before);
  });

  it("does not start a drag when typing a space in a card's title editor", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Actions for “Buy a domain name”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit title" }));
    await user.type(screen.getByRole("textbox", { name: "Card title" }), " now");

    expect(screen.queryByText(/Picked up card/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Card title" })).toHaveValue(
      "Buy a domain name now",
    );
  });
});
