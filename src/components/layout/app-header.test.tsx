import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  it("links the logo home and shows the tagline", () => {
    render(<AppHeader />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
    expect(screen.getByText("Big tasks, bite-sized.")).toBeInTheDocument();
  });

  it("renders slot content on the right", () => {
    render(
      <AppHeader>
        <button>Log in</button>
      </AppHeader>,
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});
