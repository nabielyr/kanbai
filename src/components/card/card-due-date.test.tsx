import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderDemoBoard } from "@/test/render-board";

// TEST_NOW is 23 Oct 2026, 09:00 local time.
// While the modal is open, Radix hides the board from assistive tech, so allow hidden nodes.
const tile = (title: string) =>
  screen.getByRole("button", { name: title, hidden: true }).querySelector("article")!;

async function openCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(tile(title)).getByRole("heading", { name: title }));
  return screen.findByRole("dialog");
}

const dueInput = (dialog: HTMLElement) => within(dialog).getByLabelText("Due date");

describe("card due date", () => {
  it("shows the current due date and its status", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openCard(user, "Fix contact form on mobile");

    expect(dueInput(dialog)).toHaveValue("2026-10-22");
    expect(within(dialog).getByText("Overdue · yesterday")).toBeInTheDocument();
  });

  it("sets a due date from the date field and updates the tile", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Compare free hosting options");

    expect(dueInput(dialog)).toHaveValue("");
    fireEvent.change(dueInput(dialog), { target: { value: "2026-10-25" } });

    expect(data().cards["demo-card-hosting"].dueDate).toBe("2026-10-25");
    expect(within(dialog).getByText("In 2 days")).toBeInTheDocument();
    expect(within(tile("Compare free hosting options")).getByText("In 2 days")).toBeInTheDocument();
  });

  it("sets a due date with a quick pick", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Compare free hosting options");

    const tomorrow = within(dialog).getByRole("button", { name: "Tomorrow" });
    await user.click(tomorrow);

    expect(data().cards["demo-card-hosting"].dueDate).toBe("2026-10-24");
    expect(tomorrow).toHaveAttribute("aria-pressed", "true");
    expect(dueInput(dialog)).toHaveValue("2026-10-24");

    await user.click(within(dialog).getByRole("button", { name: "Next week" }));
    expect(data().cards["demo-card-hosting"].dueDate).toBe("2026-10-30");
  });

  it("clears the due date with the Clear button or an empty field", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();
    const dialog = await openCard(user, "Fix contact form on mobile");

    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(data().cards["demo-card-contact-bug"].dueDate).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    expect(
      within(tile("Fix contact form on mobile")).queryByText(/Overdue/),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Today" }));
    fireEvent.change(dueInput(dialog), { target: { value: "" } });
    expect(data().cards["demo-card-contact-bug"].dueDate).toBeNull();
  });

  it("explains that done columns never warn", async () => {
    const user = userEvent.setup();
    renderDemoBoard();
    const dialog = await openCard(user, "Pick a color palette");

    expect(within(dialog).getByText(/won’t show due warnings/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Overdue/)).not.toBeInTheDocument();
  });
});
