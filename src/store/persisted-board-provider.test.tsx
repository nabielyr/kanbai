import { act, render, screen, waitFor } from "@testing-library/react";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { StorageConflictError, type LoadResult, type StorageAdapter } from "@/lib/storage/adapter";
import { createDemoState } from "@/lib/storage/demo-seed";
import { useBoardActions, useBoardData } from "./board-store-provider";
import { PersistedBoardProvider, useSyncStatus } from "./persisted-board-provider";

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

  describe("with an account (remote) adapter", () => {
    function SyncStatus() {
      return <p data-testid="sync">{useSyncStatus() ?? "none"}</p>;
    }

    function renderRemote(adapter: StorageAdapter) {
      return render(
        <>
          <PersistedBoardProvider
            adapter={adapter}
            createInitialData={seed}
            fallback={<p>Loading…</p>}
            loadError={(retry) => <button onClick={retry}>Try again</button>}
          >
            <TodoCount />
            <SyncStatus />
          </PersistedBoardProvider>
          <Toaster />
        </>,
      );
    }

    it("shows the load error and loads again on retry", async () => {
      const adapter = {
        ...memoryAdapter({ status: "empty" }),
        remote: true,
        load: vi
          .fn<() => Promise<LoadResult>>()
          .mockRejectedValueOnce(new Error("offline"))
          .mockResolvedValue({ status: "empty" }),
      };
      renderRemote(adapter);

      expect(screen.getByText("Loading…")).toBeInTheDocument();
      const retry = await screen.findByRole("button", { name: "Try again" });
      expect(adapter.save).not.toHaveBeenCalled();
      act(() => retry.click());
      expect(await screen.findByRole("button", { name: /To Do/ })).toHaveTextContent("To Do: 4");
    });

    it("reports Saving… then Saved", async () => {
      let finish: (() => void) | undefined;
      const adapter = {
        ...memoryAdapter({ status: "empty" }),
        remote: true,
        save: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
      };
      renderRemote(adapter);
      const button = await screen.findByRole("button", { name: /To Do/ });
      expect(screen.getByTestId("sync")).toHaveTextContent("saved");

      act(() => button.click());
      expect(screen.getByTestId("sync")).toHaveTextContent("saving");
      await waitFor(() => expect(adapter.save).toHaveBeenCalledTimes(1));
      await act(async () => finish?.());
      expect(screen.getByTestId("sync")).toHaveTextContent("saved");
    });

    it("loads the latest version when another device saved first", async () => {
      const newer = seed();
      newer.columns["demo-col-todo"].cardIds = [];
      for (const id of Object.keys(newer.cards)) {
        if (newer.cards[id].columnId === "demo-col-todo") delete newer.cards[id];
      }
      const adapter = {
        ...memoryAdapter({ status: "empty" }),
        remote: true,
        load: vi
          .fn<() => Promise<LoadResult>>()
          .mockResolvedValueOnce({ status: "empty" })
          .mockResolvedValue({ status: "ok", data: newer }),
        save: vi.fn().mockRejectedValue(new StorageConflictError([newer.boardOrder[0]])),
      };
      renderRemote(adapter);
      const button = await screen.findByRole("button", { name: /To Do/ });

      act(() => button.click());
      expect(await screen.findByText("A board was changed on another device.")).toBeInTheDocument();
      expect(button).toHaveTextContent("To Do: 0");
      expect(screen.getByTestId("sync")).toHaveTextContent("saved");
      expect(adapter.save).toHaveBeenCalledTimes(1); // conflicts aren't retried
    });

    it("has no sync status for browser-only adapters", async () => {
      render(
        <PersistedBoardProvider
          adapter={memoryAdapter({ status: "empty" })}
          createInitialData={seed}
          fallback={null}
        >
          <SyncStatus />
        </PersistedBoardProvider>,
      );
      expect(await screen.findByTestId("sync")).toHaveTextContent("none");
    });
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
