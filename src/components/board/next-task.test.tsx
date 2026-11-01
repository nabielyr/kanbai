import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

const askNext = () => screen.getByRole("button", { name: "What should I do next?" });
const cardItem = (title: string) => screen.getByRole("button", { name: title, hidden: true });

describe("What should I do next?", () => {
  it("highlights the best card and explains why", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.click(askNext());

    expect(await screen.findByText("Next up: Fix contact form on mobile")).toBeInTheDocument();
    expect(screen.getByText("Overdue · Urgent priority")).toBeInTheDocument();
    expect(cardItem("Fix contact form on mobile")).toHaveAttribute("data-suggested", "true");
    expect(cardItem("Design the landing page hero")).not.toHaveAttribute("data-suggested");
  });

  it("opens the suggested card from the toast", async () => {
    const user = userEvent.setup();
    renderDemoBoard();

    await user.click(askNext());
    const toast = (await screen.findByText("Next up: Fix contact form on mobile")).closest(
      "[data-sonner-toast]",
    ) as HTMLElement;
    await user.click(within(toast).getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("textbox", { name: "Card title" })).toHaveValue(
      "Fix contact form on mobile",
    );
  });

  it("only suggests cards that match the current filters", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "landing");

    await user.click(askNext());

    expect(await screen.findByText("Next up: Design the landing page hero")).toBeInTheDocument();
    expect(screen.getByText("Due today · High priority · Already in progress")).toBeInTheDocument();
  });

  it("says so when nothing is left to do", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "palette"); // in Done

    await user.click(askNext());

    expect(await screen.findByText("Nothing to do among the shown cards.")).toBeInTheDocument();
    expect(document.querySelector("[data-suggested]")).toBeNull();
  });
});
