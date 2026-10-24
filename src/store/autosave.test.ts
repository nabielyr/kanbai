import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "@/lib/storage/adapter";
import { createDemoState } from "@/lib/storage/demo-seed";
import { startAutosave } from "./autosave";
import { createBoardStore } from "./board-store";

function fakeAdapter(save = vi.fn(async () => {})): StorageAdapter & { save: typeof save } {
  return { load: async () => ({ status: "empty" }), save, clear: async () => {} };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const newStore = () => createBoardStore(createDemoState(new Date(2026, 9, 24)));

describe("startAutosave", () => {
  it("debounces several changes into one save of the latest data", async () => {
    const store = newStore();
    const adapter = fakeAdapter();
    startAutosave(store, adapter, { delayMs: 300 });

    const { addCard } = store.getState().actions;
    addCard("demo-col-todo", "One");
    await vi.advanceTimersByTimeAsync(100);
    addCard("demo-col-todo", "Two");
    await vi.advanceTimersByTimeAsync(299);
    expect(adapter.save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(store.getState().data);
  });

  it("does not save when nothing changed", async () => {
    const store = newStore();
    const adapter = fakeAdapter();
    startAutosave(store, adapter);
    store.getState().actions.addCard("demo-col-todo", "   "); // rejected → no change
    await vi.runAllTimersAsync();
    expect(adapter.save).not.toHaveBeenCalled();
  });

  it("flushes a pending change immediately", async () => {
    const store = newStore();
    const adapter = fakeAdapter();
    const autosave = startAutosave(store, adapter, { delayMs: 10_000 });
    store.getState().actions.deleteCard("demo-card-hero");
    await autosave.flush();
    expect(adapter.save).toHaveBeenCalledTimes(1);
  });

  it("reports failures and retries on the next change", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("full")).mockResolvedValue(undefined);
    const store = newStore();
    const onError = vi.fn();
    const onSaved = vi.fn();
    startAutosave(store, fakeAdapter(save), { onError, onSaved });

    store.getState().actions.deleteCard("demo-card-hero");
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledTimes(1);

    store.getState().actions.deleteCard("demo-card-ci");
    await vi.runAllTimersAsync();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(store.getState().data);
  });

  it("skips data marked as already saved (external changes)", async () => {
    const store = newStore();
    const adapter = fakeAdapter();
    const autosave = startAutosave(store, adapter);
    store.getState().actions.replaceState(createDemoState(new Date(2026, 0, 1)));
    autosave.markSaved();
    await vi.runAllTimersAsync();
    expect(adapter.save).not.toHaveBeenCalled();
  });

  it("stops listening after stop()", async () => {
    const store = newStore();
    const adapter = fakeAdapter();
    startAutosave(store, adapter).stop();
    store.getState().actions.deleteCard("demo-card-hero");
    await vi.runAllTimersAsync();
    expect(adapter.save).not.toHaveBeenCalled();
  });
});
