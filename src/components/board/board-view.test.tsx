import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderDemoBoard as renderDemo } from "@/test/render-board";

describe("BoardView", () => {
  it("renders the board title and its columns in order", () => {
    renderDemo();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Launch my portfolio site");
    const columns = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(columns).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("renders every card inside its column", () => {
    renderDemo();
    expect(screen.getAllByRole("article")).toHaveLength(8);
    const inProgress = screen.getByRole("region", { name: "In Progress" });
    expect(within(inProgress).getAllByRole("article")).toHaveLength(2);
    expect(within(inProgress).getByText("Design the landing page hero")).toBeInTheDocument();
  });

  it("shows due chips relative to now", () => {
    renderDemo();
    expect(screen.getByText("Overdue · yesterday")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("In 2 days")).toBeInTheDocument();
  });

  it("does not flag overdue cards in the Done column", () => {
    renderDemo();
    const done = screen.getByRole("region", { name: "Done" });
    expect(within(done).queryByText(/Overdue/)).not.toBeInTheDocument();
    expect(within(done).getByText("Oct 20")).toBeInTheDocument();
  });

  it("shows checklist progress", () => {
    renderDemo();
    const hero = screen.getByText("Design the landing page hero").closest("article")!;
    expect(within(hero).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(within(hero).getByText("3/5")).toBeInTheDocument();
  });
});
