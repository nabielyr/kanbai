import { act, render, screen, waitFor } from "@testing-library/react";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";
import type { LoadResult, StorageAdapter } from "@/lib/storage/adapter";
import { createDemoState } from "@/lib/storage/demo-seed";
import { useBoardActions, useBoardData } from "./board-store-provider";
import { PersistedBoardProvider } from "./persisted-board-provider";

const seed = () => createDemoState(new Date(2026, 9, 24));

function memoryAdapter(initial: LoadResult): StorageAdapter & { save: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => initial),
    save: vi.fn(async () => {}),
    clear: async () => {},
  };
}

function TodoCount() {
  const count = useBoardData((d) => d.columns["demo-col-todo"]?.cardIds.length ?? 0);
  const { addCard } = useBoardActions();
  return <button onClick={() => addCard("demo-col-todo", "New")}>To Do: {count}</button>;
}

function renderProvider(adapter: StorageAdapter, createInitialData = seed) {
  return render(
    <>
      <PersistedBoardProvider
        adapter={adapter}
        createInitialData={createInitialData}
        fallback={<p>Loading…</p>}
      >
        <TodoCount />
      </PersistedBoardProvider>
      <Toaster />
    </>,
  );
}

describe("PersistedBoardProvider", () => {
  it("shows the fallback, then the stored data", async () => {
    const stored = seed();
    stored.columns["demo-col-todo"].cardIds = [];
    for (const id of Object.keys(stored.cards)) {
      if (stored.cards[id].columnId === "demo-col-todo") delete stored.cards[id];
    }
    renderProvider(memoryAdapter({ status: "ok", data: stored }));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("button")).toHaveTextContent("To Do: 0");
  });

  it("starts from the initial data when nothing is stored", async () => {
    const createInitialData = vi.fn(seed);
    renderProvider(memoryAdapter({ status: "empty" }), createInitialData);
    expect(await screen.findByRole("button")).toHaveTextContent("To Do: 4");
    expect(createInitialData).toHaveBeenCalledTimes(1);
  });

  it("tells the user when stored data was corrupt and starts fresh", async () => {
    renderProvider(memoryAdapter({ status: "corrupt", reason: "x", backupKey: "k" }));
    expect(await screen.findByRole("button")).toHaveTextContent("To Do: 4");
    expect(await screen.findByText(/couldn’t be read, so we started fresh/)).toBeInTheDocument();
  });

  it("autosaves changes", async () => {
    const adapter = memoryAdapter({ status: "empty" });
    renderProvider(adapter);
    const button = await screen.findByRole("button");

    act(() => button.click());
    expect(button).toHaveTextContent("To Do: 5");
    await waitFor(() => expect(adapter.save).toHaveBeenCalledTimes(1));
  });

  it("flushes pending changes when unmounted", async () => {
    const adapter = memoryAdapter({ status: "empty" });
    const { unmount } = renderProvider(adapter);
    const button = await screen.findByRole("button");
    act(() => button.click());
    // Unmount well before the 300 ms debounce would have fired.
    unmount();
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
  });
});
