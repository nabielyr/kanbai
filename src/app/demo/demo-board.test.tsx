import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoBoard } from "./demo-board";

const BIG_CARD = "Build my portfolio website";

function renderDemo() {
  return render(
    <>
      <DemoBoard />
      <Toaster />
    </>,
  );
}

async function deleteCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: `Actions for “${title}”` }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete card" }));
}

beforeEach(() => localStorage.clear());

describe("Demo board", () => {
  it("says changes stay in this browser and links to a real board", async () => {
    renderDemo();
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText(/Changes stay in this browser/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start my own board" })).toHaveAttribute(
      "href",
      "/boards",
    );
  });

  it("resets the demo, and Undo brings your changes back", async () => {
    const user = userEvent.setup();
    renderDemo();
    await screen.findByRole("heading", { level: 1 });
    await deleteCard(user, BIG_CARD);
    expect(screen.queryByText(BIG_CARD)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await screen.findByText(BIG_CARD)).toBeInTheDocument();

    const toast = (await screen.findByText("Demo board reset")).closest("li")!;
    await user.click(within(toast).getByRole("button", { name: "Undo" }));
    expect(screen.queryByText(BIG_CARD)).not.toBeInTheDocument();
  });
});
