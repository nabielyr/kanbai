import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageError } from "./adapter";
import { createDemoState } from "./demo-seed";
import { createLocalStorageAdapter, storageKey } from "./local-storage-adapter";

const state = createDemoState(new Date(2026, 9, 24));
const KEY = storageKey("demo");

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("createLocalStorageAdapter", () => {
  it("reports empty when nothing is stored", async () => {
    expect(await createLocalStorageAdapter("demo").load()).toEqual({ status: "empty" });
  });

  it("round-trips the state", async () => {
    const adapter = createLocalStorageAdapter("demo");
    await adapter.save(state);
    expect(await adapter.load()).toEqual({ status: "ok", data: state });
  });

  it("keeps namespaces separate", async () => {
    await createLocalStorageAdapter("demo").save(state);
    expect(await createLocalStorageAdapter("workspace").load()).toEqual({ status: "empty" });
  });

  it("moves invalid JSON aside to a backup key", async () => {
    localStorage.setItem(KEY, "{not json");
    const result = await createLocalStorageAdapter("demo").load();

    expect(result).toMatchObject({ status: "corrupt", reason: "not valid JSON" });
    const backupKey = (result as { backupKey: string }).backupKey;
    expect(backupKey).toMatch(/^kanbai:v1:demo:corrupt-\d+$/);
    expect(localStorage.getItem(backupKey)).toBe("{not json");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("treats schema-invalid data as corrupt", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: 42 }));
    expect(await createLocalStorageAdapter("demo").load()).toMatchObject({ status: "corrupt" });
  });

  it("throws a StorageError when writing fails (e.g. quota exceeded)", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(createLocalStorageAdapter("demo").save(state)).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it("degrades gracefully without storage", async () => {
    const adapter = createLocalStorageAdapter("demo", null);
    expect(await adapter.load()).toEqual({ status: "empty" });
    await expect(adapter.save(state)).rejects.toBeInstanceOf(StorageError);
    await expect(adapter.clear()).resolves.toBeUndefined();
  });

  it("clears its own key only", async () => {
    const adapter = createLocalStorageAdapter("demo");
    await adapter.save(state);
    localStorage.setItem("other", "keep");
    await adapter.clear();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
  });

  it("notifies about changes made in other tabs", () => {
    const onChange = vi.fn();
    const unsubscribe = createLocalStorageAdapter("demo").subscribe!(onChange);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "unrelated", storageArea: localStorage }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, storageArea: localStorage }));
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, storageArea: localStorage }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
