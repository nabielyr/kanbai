import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Landing page", () => {
  it("leads to the demo and to your own board", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Big tasks, bite-sized.");
    expect(screen.getByRole("link", { name: /Try the demo board/ })).toHaveAttribute(
      "href",
      "/demo",
    );
    expect(screen.getByRole("link", { name: "Start my own board" })).toHaveAttribute(
      "href",
      "/boards",
    );
  });

  it("explains how it works and the free AI limit", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Dump the big task",
      "Hit “Chunk it”",
      "Do the next one",
    ]);
    expect(screen.getByText(/Guests get 3 free AI chunks/)).toBeInTheDocument();
  });
});
