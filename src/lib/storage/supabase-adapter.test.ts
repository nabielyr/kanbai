import { beforeEach, describe, expect, it } from "vitest";
import type { PersistedState } from "@/lib/domain/types";
import { createBoardStore } from "@/store/board-store";
import { createFakeBoardsDb, type FakeBoardsDb } from "@/test/fake-boards-db";
import { StorageConflictError, StorageError, type LoadResult } from "./adapter";
import { createDemoState } from "./demo-seed";
import { activeBoardKey, createSupabaseAdapter } from "./supabase-adapter";

const USER = "user-a";
let db: FakeBoardsDb;
let counter = 0;

beforeEach(() => {
  db = createFakeBoardsDb();
  localStorage.clear();
  counter = 0;
});

/** One "device": an adapter for USER with its own memory of what it last synced. */
const device = (userId = USER) => createSupabaseAdapter(db.clientFor(userId), userId);

const storeOf = (data: PersistedState) =>
  createBoardStore(data, {
    createId: () => `id-${++counter}`,
    now: () => "2026-11-05T10:00:00.000Z",
  });

/** The demo board plus a second, empty board. */
function twoBoards() {
  const store = storeOf(createDemoState(new Date(2026, 10, 5)));
  store.getState().actions.createBoard("Thesis");
  return store;
}

function expectOk(result: LoadResult): PersistedState {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
  return result.data;
}

const writes = () => db.requests.filter((r) => r.op !== "select");

describe("createSupabaseAdapter", () => {
  it("reports an empty account as empty", async () => {
    expect(await device().load()).toEqual({ status: "empty" });
  });

  it("stores one row per board and loads them back on another device", async () => {
    const store = twoBoards();
    const data = store.getState().data;
    const a = device();
    await a.load();
    await a.save(data);

    expect(db.rowsOf(USER).map((r) => [r.id, r.title, r.position, r.rev])).toEqual([
      [data.boardOrder[0], "Launch my portfolio site 🚀", 0, 1],
      ["id-1", "Thesis", 1, 1],
    ]);

    localStorage.clear(); // a different browser doesn't know which board was open
    const loaded = expectOk(await device().load());
    expect(loaded).toEqual({ ...data, activeBoardId: data.boardOrder[0] });
  });

  it("reopens the board this device had open", async () => {
    const store = twoBoards(); // "Thesis" is active after creating it
    const a = device();
    await a.load();
    await a.save(store.getState().data);
    expect(localStorage.getItem(activeBoardKey(USER))).toBe("id-1");
    expect(expectOk(await device().load()).activeBoardId).toBe("id-1");
  });

  it("writes only the boards that changed", async () => {
    const store = twoBoards();
    const a = device();
    await a.load();
    await a.save(store.getState().data);
    db.requests.length = 0;

    store.getState().actions.renameBoard("id-1", "Thesis v2");
    await a.save(store.getState().data);
    expect(writes()).toEqual([{ op: "update", userId: USER, id: undefined }]);
    expect(db.rowsOf(USER).find((r) => r.id === "id-1")).toMatchObject({
      title: "Thesis v2",
      rev: 2,
    });

    db.requests.length = 0;
    store.getState().actions.setActiveBoard(store.getState().data.boardOrder[0]);
    await a.save(store.getState().data);
    expect(writes()).toEqual([]); // switching boards stays on this device
  });

  it("writes nothing after loading untouched boards (even with jsonb key order)", async () => {
    const a = device();
    await a.load();
    await a.save(twoBoards().getState().data);
    db.requests.length = 0;

    const b = device();
    const loaded = expectOk(await b.load());
    await b.save(loaded);
    expect(writes()).toEqual([]);
  });

  it("deletes the row of a deleted board", async () => {
    const store = twoBoards();
    const a = device();
    await a.load();
    await a.save(store.getState().data);

    store.getState().actions.deleteBoard("id-1");
    await a.save(store.getState().data);
    expect(db.rowsOf(USER).map((r) => r.id)).toEqual([store.getState().data.boardOrder[0]]);
  });

  it("refuses to overwrite a board another device saved first", async () => {
    const seed = twoBoards().getState().data;
    const a = device();
    await a.load();
    await a.save(seed);

    const phone = device();
    const laptop = device();
    const storeOnPhone = storeOf(expectOk(await phone.load()));
    const storeOnLaptop = storeOf(expectOk(await laptop.load()));

    storeOnPhone.getState().actions.renameBoard("id-1", "From the phone");
    await phone.save(storeOnPhone.getState().data);

    storeOnLaptop.getState().actions.renameBoard("id-1", "From the laptop");
    const error = await laptop.save(storeOnLaptop.getState().data).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageConflictError);
    expect((error as StorageConflictError).boardIds).toEqual(["id-1"]);
    expect(db.rowsOf(USER).find((r) => r.id === "id-1")?.title).toBe("From the phone");

    // After reloading, the laptop can save again.
    const fresh = storeOf(expectOk(await laptop.load()));
    expect(fresh.getState().data.boards["id-1"].title).toBe("From the phone");
    fresh.getState().actions.renameBoard("id-1", "Laptop, second try");
    await laptop.save(fresh.getState().data);
    expect(db.rowsOf(USER).find((r) => r.id === "id-1")).toMatchObject({
      title: "Laptop, second try",
      rev: 3,
    });
  });

  it("doesn't resurrect a board deleted on another device", async () => {
    const store = twoBoards();
    const a = device();
    await a.load();
    await a.save(store.getState().data);

    const other = device();
    const otherStore = storeOf(expectOk(await other.load()));
    otherStore.getState().actions.renameBoard("id-1", "Edited elsewhere");
    await other.save(otherStore.getState().data);

    store.getState().actions.deleteBoard("id-1");
    await expect(a.save(store.getState().data)).rejects.toBeInstanceOf(StorageConflictError);
    expect(db.rowsOf(USER).map((r) => r.id)).toContain("id-1");
  });

  it("throws on a failed save and resends only what is still unsaved", async () => {
    const store = twoBoards();
    const a = device();
    await a.load();
    db.failNext(1);
    const error = await a.save(store.getState().data).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error).not.toBeInstanceOf(StorageConflictError);
    expect(db.rowsOf(USER)).toHaveLength(1); // the other board's insert went through

    db.requests.length = 0;
    await a.save(store.getState().data);
    expect(writes()).toHaveLength(1);
    expect(db.rowsOf(USER)).toHaveLength(2);
  });

  it("runs saves one after another, so quick saves never conflict with each other", async () => {
    const store = twoBoards();
    const a = device();
    await a.load();
    await a.save(store.getState().data);

    store.getState().actions.renameBoard("id-1", "One");
    const first = a.save(store.getState().data);
    store.getState().actions.renameBoard("id-1", "Two");
    const second = a.save(store.getState().data);
    await Promise.all([first, second]);
    expect(db.rowsOf(USER).find((r) => r.id === "id-1")).toMatchObject({ title: "Two", rev: 3 });
  });

  it("rejects when the boards can't be loaded, instead of starting empty", async () => {
    db.failNext(1);
    await expect(device().load()).rejects.toBeInstanceOf(StorageError);
  });

  it("skips unreadable boards and never touches them", async () => {
    const a = device();
    await a.load();
    await a.save(twoBoards().getState().data);
    db.rows.push({
      user_id: USER,
      id: "broken",
      title: "From a newer app",
      position: 2,
      data: { version: 99 },
      rev: 4,
    });

    const b = device();
    const result = await b.load();
    expect(result).toMatchObject({ status: "ok", skippedBoards: 1 });
    const loaded = expectOk(result);
    expect(loaded.boardOrder).not.toContain("broken");

    const store = storeOf(loaded);
    store.getState().actions.deleteBoard("id-1");
    await b.save(store.getState().data);
    expect(db.rowsOf(USER).find((r) => r.id === "broken")).toMatchObject({
      data: { version: 99 },
      rev: 4,
    });
  });

  it("keeps each user's boards separate", async () => {
    const a = device("user-a");
    await a.load();
    await a.save(twoBoards().getState().data);
    expect(await device("user-b").load()).toEqual({ status: "empty" });
  });

  it("clear() forgets this device's state but deletes nothing from the account", async () => {
    const a = device();
    await a.load();
    await a.save(twoBoards().getState().data);
    await a.clear();
    expect(localStorage.getItem(activeBoardKey(USER))).toBeNull();
    expect(db.rowsOf(USER)).toHaveLength(2);
  });

  describe("subscribe", () => {
    async function synced() {
      const store = twoBoards();
      const a = device();
      await a.load();
      await a.save(store.getState().data);
      return { a, store };
    }

    const focus = async () => {
      window.dispatchEvent(new Event("focus"));
      // Let the check request settle.
      for (let i = 0; i < 5; i++) await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    it("notifies when another device changed a board", async () => {
      const { a } = await synced();
      let calls = 0;
      const unsubscribe = a.subscribe!(() => calls++);

      const other = device();
      const otherStore = storeOf(expectOk(await other.load()));
      otherStore.getState().actions.renameBoard("id-1", "Elsewhere");
      await other.save(otherStore.getState().data);

      await focus();
      expect(calls).toBe(1);
      unsubscribe();
    });

    it("stays quiet when nothing changed, or when this device made the change", async () => {
      const { a, store } = await synced();
      let calls = 0;
      const unsubscribe = a.subscribe!(() => calls++);

      store.getState().actions.renameBoard("id-1", "Here");
      await a.save(store.getState().data);
      await focus();
      expect(calls).toBe(0);
      unsubscribe();
    });
  });
});
