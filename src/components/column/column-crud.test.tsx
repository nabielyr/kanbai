import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { renderDemoBoard } from "@/test/render-board";

const columnNames = () =>
  screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("column CRUD", () => {
  it("adds columns at the end of the board", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByRole("textbox", { name: "New column name" }), "Review{Enter}");
    await user.keyboard("{Escape}");

    expect(columnNames()).toEqual(["To Do", "In Progress", "Done", "Review"]);
    expect(data().boards[DEMO_BOARD_ID].columnIds).toHaveLength(4);
  });

  it("renames a column by clicking its title", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "To Do" }));
    const input = screen.getByRole("textbox", { name: "Column name" });
    await user.clear(input);
    await user.type(input, "Backlog{Enter}");

    expect(data().columns["demo-col-todo"].title).toBe("Backlog");
    expect(columnNames()[0]).toBe("Backlog");
  });

  it("renames a column from its menu", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Actions for column “Done”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Column name" });
    await user.clear(input);
    await user.type(input, "Shipped{Enter}");

    expect(data().columns["demo-col-done"].title).toBe("Shipped");
  });

  it("toggles the done flag", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Actions for column “In Progress”" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Done column" }));

    expect(data().columns["demo-col-doing"].isDone).toBe(true);
    // Due warnings disappear for cards in a done column.
    const doing = screen.getByRole("region", { name: "In Progress" });
    expect(within(doing).queryByText("Today")).not.toBeInTheDocument();
  });

  it("asks before deleting a column that has cards", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Actions for column “In Progress”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete column" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This also deletes its 2 cards");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(data().columns["demo-col-doing"]).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Actions for column “In Progress”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete column" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete column",
      }),
    );

    expect(data().columns["demo-col-doing"]).toBeUndefined();
    expect(data().cards["demo-card-hero"]).toBeUndefined();
    expect(columnNames()).toEqual(["To Do", "Done"]);
  });

  it("deletes an empty column without asking", async () => {
    const user = userEvent.setup();
    const { data } = renderDemoBoard();

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByRole("textbox", { name: "New column name" }), "Temp{Enter}");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Actions for column “Temp”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete column" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(data().boards[DEMO_BOARD_ID].columnIds).toHaveLength(3);
  });
});
