import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

  it("pops the suggested steps in one after another", async () => {
    const user = userEvent.setup();
    stubFetch(success());
    renderDemoBoard();
    const dialog = await openFromMenu(user);
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));

    const list = await within(dialog).findByRole("list", { name: "Suggested subtasks" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.style.animationDelay)).toEqual(["0ms", "60ms", "120ms"]);
    rows.forEach((row) => expect(row).toHaveClass("animate-pop-in"));

    // Once a row has popped in it stays put, so reordering never replays it.
    // jsdom has no AnimationEvent, so React listens for the prefixed event name instead.
    fireEvent(rows[1], new Event("webkitAnimationEnd", { bubbles: true }));
    expect(rows[1]).not.toHaveClass("animate-pop-in");
    expect(rows[1].style.animationDelay).toBe("");
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

  it("asks you to wait when the AI is busy, then retries", async () => {
    const user = userEvent.setup();
    stubFetch(
      Response.json(makeApiError("RATE_LIMITED", "The AI is busy right now.", 1), { status: 429 }),
      success(),
    );
    renderDemoBoard();
    const dialog = await openFromMenu(user);

    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("The AI is busy");
    expect(within(alert).getByRole("button", { name: "Try again in 1s" })).toBeDisabled();

    const retry = await within(alert).findByRole(
      "button",
      { name: "Try again" },
      { timeout: 3000 },
    );
    await user.click(retry);
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

  it("accepts the steps as a checklist on the card", async () => {
    const user = userEvent.setup();
    stubFetch(success());
    const { data } = renderDemoBoard();
    const dialog = await openFromMenu(user);
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    await within(dialog).findByRole("list", { name: "Suggested subtasks" });

    expect(
      within(dialog).getByRole("radio", { name: "Add as a checklist on this card" }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Chunk it" })).not.toBeInTheDocument(),
    );
    expect(data().cards["demo-card-portfolio"].checklist).toEqual([
      expect.objectContaining({ title: "Pick a site template", estimateMinutes: 20, source: "ai" }),
      expect.objectContaining({ title: "Write the about page", estimateMinutes: 60, source: "ai" }),
      expect.objectContaining({ title: "Deploy to Vercel", estimateMinutes: 25, source: "ai" }),
    ]);
    expect(await screen.findByText("Added 3 steps to the checklist.")).toBeInTheDocument();
  });

  it("accepts the steps as new cards in the chosen column", async () => {
    const user = userEvent.setup();
    stubFetch(success());
    const { data } = renderDemoBoard();
    const doingBefore = data().columns["demo-col-doing"].cardIds;
    const dialog = await openFromMenu(user);
    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    await within(dialog).findByRole("list", { name: "Suggested subtasks" });

    const column = within(dialog).getByRole("combobox", { name: "Column for the new cards" });
    expect(column).toHaveValue("demo-col-todo"); // the board's first column by default
    await user.selectOptions(column, "In Progress");
    expect(within(dialog).getByRole("radio", { name: /Create as new cards in/ })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Accept" }));

    const doing = data().columns["demo-col-doing"].cardIds;
    expect(doing.slice(0, doingBefore.length)).toEqual(doingBefore);
    const created = doing.slice(doingBefore.length).map((id) => data().cards[id]);
    expect(created.map((c) => c.title)).toEqual(SUBTASKS.map((s) => s.title));
    expect(created[0]).toMatchObject({
      priority: "high",
      labelIds: ["demo-label-dev", "demo-label-design"],
    });
    expect(await screen.findByText("Created 3 cards in In Progress.")).toBeInTheDocument();
  });

  it("lets you write the steps by hand when the daily quota is used up", async () => {
    const user = userEvent.setup();
    stubFetch(Response.json(makeApiError("QUOTA_EXHAUSTED", "Quota used up."), { status: 503 }));
    const { data } = renderDemoBoard();
    const dialog = await openFromMenu(user, "Compare free hosting options");

    await user.click(within(dialog).getByRole("button", { name: "Generate steps" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Daily AI quota reached");
    expect(within(alert).queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Add steps by hand" }));
    expect(within(dialog).getByRole("button", { name: "Accept" })).toBeDisabled();
    await user.type(
      within(dialog).getByRole("textbox", { name: "New subtask" }),
      "Try Netlify{Enter}",
    );
    await user.click(within(dialog).getByRole("button", { name: "Accept" }));

    expect(data().cards["demo-card-hosting"].checklist.map((i) => i.title)).toEqual([
      "Try Netlify",
    ]);
  });
});
