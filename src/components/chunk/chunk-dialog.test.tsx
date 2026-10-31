import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeApiError } from "@/lib/ai/schemas";
import { renderDemoBoard } from "@/test/render-board";

const BIG_CARD = "Build my portfolio website";
const SUBTASKS = [
  { title: "Pick a site template", estimateMinutes: 20, order: 1 },
  { title: "Write the about page", estimateMinutes: 60, order: 2 },
  { title: "Deploy to Vercel", estimateMinutes: 25, order: 3 },
];

function stubFetch(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return next;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** A request that only ends when it is aborted, like a slow AI. */
function stubPendingFetch() {
  const fetch = vi.fn<typeof globalThis.fetch>(
    (_, init) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const success = (subtasks = SUBTASKS) => Response.json({ subtasks, provider: "gemini" });

async function openFromMenu(user: ReturnType<typeof userEvent.setup>, title = BIG_CARD) {
  await user.click(screen.getByRole("button", { name: `Actions for “${title}”` }));
  await user.click(await screen.findByRole("menuitem", { name: "Chunk it" }));
  return screen.findByRole("dialog", { name: "Chunk it" });
}

const stepTitles = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("list", { name: "Suggested subtasks" }))
    .getAllByRole("textbox")
    .map((input) => (input as HTMLInputElement).value);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Chunk it dialog", () => {
  it("generates a preview from the card's title, description and detail level", async () => {
    const user = userEvent.setup();
    const fetch = stubFetch(success());
    const { data } = renderDemoBoard();
    const dialog = await openFromMenu(user);

    await user.click(within(dialog).getByRole("radio", { name: /Detailed/ }));
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));

    expect(
      await within(dialog).findByRole("list", { name: "Suggested subtasks" }),
    ).toBeInTheDocument();
    expect(stepTitles(dialog)).toEqual(SUBTASKS.map((s) => s.title));
    expect(within(dialog).getByText("by Gemini")).toBeInTheDocument();
    expect(within(dialog).getByText("1 h 45 min")).toBeInTheDocument();

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body).toEqual({
      title: BIG_CARD,
      description: data().cards["demo-card-portfolio"].description,
      detail: "detailed",
    });
  });

  it("lets you edit, remove, add and reorder steps without saving anything", async () => {
    const user = userEvent.setup();
    stubFetch(success());
    const { data } = renderDemoBoard();
    const before = data();
    const dialog = await openFromMenu(user);
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    await within(dialog).findByRole("list", { name: "Suggested subtasks" });

    const first = within(dialog).getByRole("textbox", { name: "Step 1" });
    await user.clear(first);
    await user.type(first, "Choose a template{Enter}");

    const minutes = within(dialog).getByRole("spinbutton", {
      name: "Minutes for “Deploy to Vercel”",
    });
    await user.clear(minutes);
    await user.type(minutes, "33");
    await user.tab();
    expect(minutes).toHaveValue(35);

    await user.click(within(dialog).getByRole("button", { name: "Remove “Write the about page”" }));
    await user.type(
      within(dialog).getByRole("textbox", { name: "New subtask" }),
      "Share the link{Enter}",
    );

    within(dialog).getByRole("button", { name: "Reorder “Share the link”" }).focus();
    await user.keyboard("{ArrowUp}");

    expect(stepTitles(dialog)).toEqual(["Choose a template", "Share the link", "Deploy to Vercel"]);
    expect(within(dialog).getByText("1 h 10 min")).toBeInTheDocument(); // 20 + 15 + 35
    expect(data()).toBe(before);
  });

  it("can be cancelled while the AI is thinking", async () => {
    const user = userEvent.setup();
    stubPendingFetch();
    renderDemoBoard();
    const dialog = await openFromMenu(user);

    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Thinking up steps");
    expect(within(dialog).getByRole("radio", { name: /Brief/ })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate steps" })).toBeInTheDocument();
  });

  it("shows the server's message and retries", async () => {
    const user = userEvent.setup();
    stubFetch(
      Response.json(makeApiError("RATE_LIMITED", "The AI is busy right now.", 20), { status: 429 }),
      success(),
    );
    renderDemoBoard();
    const dialog = await openFromMenu(user);

    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The AI is busy right now.");

    await user.click(within(dialog).getByRole("button", { name: "Try again" }));
    await within(dialog).findByRole("list", { name: "Suggested subtasks" });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("regenerates, replacing the preview", async () => {
    const user = userEvent.setup();
    stubFetch(success(), success([...SUBTASKS].reverse().map((s, i) => ({ ...s, order: i + 1 }))));
    renderDemoBoard();
    const dialog = await openFromMenu(user);

    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    await within(dialog).findByRole("list", { name: "Suggested subtasks" });
    await user.click(within(dialog).getByRole("button", { name: "Regenerate" }));

    await waitFor(() => expect(stepTitles(dialog)[0]).toBe("Deploy to Vercel"));
  });

  it("opens from the card dialog and returns to it when closed", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderDemoBoard();

    const tile = screen.getByRole("button", { name: BIG_CARD }).querySelector("article")!;
    await user.click(within(tile).getByRole("heading", { name: BIG_CARD }));
    const cardDialog = await screen.findByRole("dialog");
    await user.click(within(cardDialog).getByRole("button", { name: "Chunk it" }));

    const chunkDialog = await screen.findByRole("dialog", { name: "Chunk it" });
    await user.click(within(chunkDialog).getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Chunk it" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox", { name: "Card title" })).toHaveValue(BIG_CARD);
  });
});
