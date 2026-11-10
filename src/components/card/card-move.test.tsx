import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

const TODO = "demo-col-todo";
const DOING = "demo-col-doing";

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: `Actions for “${title}”` }));
  return screen.findByRole("menu");
}

describe("moving a card from its menu", () => {
  it("lists the other columns and moves the card to the bottom of the one picked", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const menu = await openMenu(user, "Write a case study for KanbAI");
    const group = within(menu).getByRole("group", { name: "Move card" });

    expect(within(group).queryByRole("menuitem", { name: "To Do" })).toBeNull();
    await user.click(within(group).getByRole("menuitem", { name: "In Progress" }));

    expect(data().columns[DOING].cardIds.at(-1)).toBe("demo-card-case-study");
    expect(data().columns[TODO].cardIds).not.toContain("demo-card-case-study");
    expect(screen.getByText("Moved “Write a case study for KanbAI” to In Progress")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Write a case study for KanbAI" })).toHaveFocus(),
    );
  });

  it("puts the card back where it was with Undo", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const before = data().columns[TODO].cardIds;
    const menu = await openMenu(user, "Write a case study for KanbAI");

    await user.click(within(menu).getByRole("menuitem", { name: "Done" }));
    await user.click(await screen.findByRole("button", { name: "Undo" }));

    expect(data().columns[TODO].cardIds).toEqual(before);
  });

  it("moves up and down within the column, and not past either end", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    let menu = await openMenu(user, "Build my portfolio website");
    expect(within(menu).getByRole("menuitem", { name: "Move up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(within(menu).getByRole("menuitem", { name: "Move down" }));
    expect(data().columns[TODO].cardIds.slice(0, 2)).toEqual([
      "demo-card-case-study",
      "demo-card-portfolio",
    ]);

    menu = await openMenu(user, "Build my portfolio website");
    await user.click(within(menu).getByRole("menuitem", { name: "Move up" }));
    expect(data().columns[TODO].cardIds[0]).toBe("demo-card-portfolio");

    menu = await openMenu(user, "Compare free hosting options");
    expect(within(menu).getByRole("menuitem", { name: "Move down" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("steps past cards hidden by a filter", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    // Matches the portfolio card (description) and the contact form bug, not the case study.
    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "contact");

    const menu = await openMenu(user, "Build my portfolio website");
    await user.click(within(menu).getByRole("menuitem", { name: "Move down" }));

    expect(data().columns[TODO].cardIds).toEqual([
      "demo-card-case-study",
      "demo-card-contact-bug",
      "demo-card-portfolio",
      "demo-card-hosting",
    ]);
  });
});
