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

  it("retries a failed save with backoff when asked to", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const store = newStore();
    startAutosave(store, fakeAdapter(save), { delayMs: 100, retryDelaysMs: [1000, 5000] });

    store.getState().actions.deleteCard("demo-card-hero");
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(3);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(3); // saved, so no more retries
  });

  it("doesn't retry errors that shouldRetry rejects", async () => {
    const save = vi.fn().mockRejectedValue(new Error("conflict"));
    const store = newStore();
    startAutosave(store, fakeAdapter(save), {
      retryDelaysMs: [1000],
      shouldRetry: () => false,
    });
    store.getState().actions.deleteCard("demo-card-hero");
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reports pending → saving → saved, and error when a save fails", async () => {
    let finish: (() => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));
    const statuses: string[] = [];
    const store = newStore();
    const autosave = startAutosave(store, fakeAdapter(save), {
      delayMs: 100,
      onStatusChange: (s) => statuses.push(s),
    });
    expect(autosave.getStatus()).toBe("saved");

    store.getState().actions.deleteCard("demo-card-hero");
    await vi.advanceTimersByTimeAsync(100);
    finish?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toEqual(["pending", "saving", "saved"]);

    store.getState().actions.deleteCard("demo-card-ci");
    await vi.advanceTimersByTimeAsync(100);
    fail?.(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.slice(3)).toEqual(["pending", "saving", "error"]);

    autosave.markSaved();
    expect(statuses.at(-1)).toBe("saved");
  });

  it("doesn't report or retry a last flush that fails after stop() (e.g. on logout)", async () => {
    const save = vi.fn().mockRejectedValue(new Error("signed out"));
    const store = newStore();
    const onError = vi.fn();
    const autosave = startAutosave(store, fakeAdapter(save), { onError, retryDelaysMs: [1000] });
    store.getState().actions.deleteCard("demo-card-hero");
    const flushed = autosave.flush();
    autosave.stop();
    await flushed;
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
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
