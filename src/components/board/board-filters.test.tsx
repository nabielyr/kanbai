import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

// An open menu hides the board from assistive tech (Radix), so allow hidden nodes.
const card = (title: string) => screen.queryByRole("button", { name: title, hidden: true });
const column = (title: string) => screen.getByRole("region", { name: title });
const search = () => screen.getByRole("searchbox", { name: "Search cards" });

async function openFilterMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filter cards/ }));
  return screen.findByRole("menu");
}

describe("board search and filters", () => {
  it("searches cards and shows how many match", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    expect(screen.queryByText(/cards shown/)).not.toBeInTheDocument();

    await user.type(search(), "landing");

    expect(card("Design the landing page hero")).toBeInTheDocument();
    expect(card("Buy a domain name")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 8 cards shown")).toBeInTheDocument();
    expect(within(column("In Progress")).getByText("1/2")).toBeInTheDocument();
    expect(within(column("To Do")).getByText("No matching cards")).toBeInTheDocument();
  });

  it("combines filters from the menu and keeps the menu open while ticking", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const menu = await openFilterMenu(user);

    await user.click(within(menu).getByRole("menuitemcheckbox", { name: "design" }));
    await user.click(within(menu).getByRole("menuitemcheckbox", { name: "High" }));

    expect(within(menu).getByRole("menuitemcheckbox", { name: "design" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(card("Build my portfolio website")).toBeInTheDocument();
    expect(card("Design the landing page hero")).toBeInTheDocument();
    expect(card("Pick a color palette")).not.toBeInTheDocument(); // design, but low priority
    expect(screen.getByText("2 of 8 cards shown")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Filter cards (2 selected)" })).toBeInTheDocument();
  });

  it("filters by due date", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const menu = await openFilterMenu(user);

    await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Overdue" }));

    expect(card("Fix contact form on mobile")).toBeInTheDocument();
    expect(card("Pick a color palette")).not.toBeInTheDocument(); // in Done, never overdue
    expect(screen.getByText("1 of 8 cards shown")).toBeInTheDocument();
  });

  it("clears everything at once", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    await user.type(search(), "zzz");
    expect(screen.getByText("0 of 8 cards shown")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(search()).toHaveValue("");
    expect(card("Buy a domain name")).toBeInTheDocument();
    expect(screen.queryByText(/cards shown/)).not.toBeInTheDocument();
  });

  it("tells you when a new card is hidden by the filters", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    await user.type(search(), "landing");

    await user.click(within(column("To Do")).getByRole("button", { name: "Add card" }));
    await user.type(
      screen.getByRole("textbox", { name: "New card title in To Do" }),
      "Ship it{Enter}",
    );

    expect(Object.values(data().cards).some((c) => c.title === "Ship it")).toBe(true);
    expect(await screen.findByText(/hidden by the current filters/)).toBeInTheDocument();
    const toastEl = screen
      .getByText(/hidden by the current filters/)
      .closest("[data-sonner-toast]");
    await user.click(within(toastEl as HTMLElement).getByRole("button", { name: "Clear filters" }));
    expect(card("Ship it")).toBeInTheDocument();
  });

  it("still lets visible cards be picked up while filtering", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const before = data();
    await user.type(search(), "landing");

    card("Design the landing page hero")!.focus();
    await user.keyboard(" ");
    expect(
      await screen.findByText(/Picked up card “Design the landing page hero”/),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(data()).toBe(before);
  });
});
