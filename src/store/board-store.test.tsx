import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { createBoardStore, type BoardStore } from "./board-store";
import { BoardStoreProvider, useBoardActions, useBoardData } from "./board-store-provider";

const NOW = "2026-10-24T10:00:00.000Z";

let store: BoardStore;
beforeEach(() => {
  let n = 0;
  store = createBoardStore(createDemoState(new Date(2026, 9, 24)), {
    createId: () => `id-${++n}`,
    now: () => NOW,
  });
});

const data = () => store.getState().data;
const actions = () => store.getState().actions;

describe("createBoardStore", () => {
  it("adds a card and returns its id", () => {
    const id = actions().addCard("demo-col-todo", "Write tests");
    expect(id).toBe("id-1");
    expect(data().cards["id-1"]).toMatchObject({ title: "Write tests", createdAt: NOW });
    expect(data().columns["demo-col-todo"].cardIds.at(-1)).toBe("id-1");
  });

  it("returns null and leaves state untouched for rejected input", () => {
    const before = data();
    expect(actions().addCard("demo-col-todo", "   ")).toBeNull();
    expect(actions().addColumn("missing-board", "Review")).toBeNull();
    expect(data()).toBe(before);
  });

  it("only notifies subscribers when something changed", () => {
    const listener = vi.fn();
    store.subscribe(listener);
    actions().moveCard("demo-card-portfolio", "demo-col-todo", "demo-card-case-study"); // no-op
    expect(listener).not.toHaveBeenCalled();
    actions().moveCard("demo-card-portfolio", "demo-col-done", null);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the state consistent through a sequence of actions", () => {
    const columnId = actions().addColumn(DEMO_BOARD_ID, "Review")!;
    const cardId = actions().addCard(columnId, "Check the README")!;
    actions().moveCard("demo-card-hero", columnId, cardId);
    actions().updateCard(cardId, { priority: "high" });
    actions().renameColumn(columnId, "In Review");
    actions().moveColumn(columnId, 0);
    actions().deleteCard("demo-card-domain");
    actions().deleteColumn("demo-col-doing");

    const d = data();
    expect(findIntegrityIssues(d)).toEqual([]);
    expect(d.boards[DEMO_BOARD_ID].columnIds[0]).toBe(columnId);
    expect(d.columns[columnId]).toMatchObject({
      title: "In Review",
      cardIds: ["demo-card-hero", cardId],
    });
    expect(d.cards[cardId].priority).toBe("high");
  });

  it("adds, updates and deletes labels", () => {
    const id = actions().addLabel(DEMO_BOARD_ID, "urgent fix", "rose")!;
    expect(id).toBe("id-1");
    expect(actions().addLabel(DEMO_BOARD_ID, "Urgent Fix", "sky")).toBeNull();

    actions().updateCard("demo-card-domain", { labelIds: [id] });
    expect(actions().updateLabel(DEMO_BOARD_ID, id, { name: "hotfix" })).toBe(true);
    expect(actions().updateLabel(DEMO_BOARD_ID, id, { name: "  " })).toBe(false);
    expect(data().boards[DEMO_BOARD_ID].labels.at(-1)).toEqual({
      id,
      name: "hotfix",
      color: "rose",
    });

    actions().deleteLabel(DEMO_BOARD_ID, id);
    expect(data().cards["demo-card-domain"].labelIds).toEqual([]);
    expect(findIntegrityIssues(data())).toEqual([]);
  });

  it("replaces the whole state", () => {
    const fresh = createDemoState(new Date(2026, 0, 1));
    actions().replaceState(fresh);
    expect(data()).toBe(fresh);
  });
});

describe("BoardStoreProvider hooks", () => {
  function CardCount() {
    const count = useBoardData((d) => d.columns["demo-col-todo"].cardIds.length);
    const { addCard } = useBoardActions();
    return <button onClick={() => addCard("demo-col-todo", "From the UI")}>To Do: {count}</button>;
  }

  it("reads data and re-renders after an action", () => {
    render(
      <BoardStoreProvider store={store}>
        <CardCount />
      </BoardStoreProvider>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("To Do: 4");
    act(() => button.click());
    expect(button).toHaveTextContent("To Do: 5");
  });

  it("throws a helpful error outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<CardCount />)).toThrow(/inside <BoardStoreProvider>/);
  });
});
