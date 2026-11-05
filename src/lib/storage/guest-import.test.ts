import { beforeEach, describe, expect, it } from "vitest";
import { createBoardStore } from "@/store/board-store";
import { createDemoState } from "./demo-seed";
import {
  clearGuestBoards,
  findGuestBoardsToImport,
  guestImportKey,
  markGuestBoardsHandled,
} from "./guest-import";
import { storageKey } from "./local-storage-adapter";
import { createWorkspaceState } from "./workspace-seed";

const USER = "user-a";

function storeGuest(data: unknown) {
  localStorage.setItem(storageKey("workspace"), JSON.stringify(data));
}

function guestWithThesis() {
  const store = createBoardStore(createWorkspaceState(new Date(2026, 10, 5)));
  store.getState().actions.createBoard("Thesis");
  return store;
}

beforeEach(() => localStorage.clear());

describe("findGuestBoardsToImport", () => {
  it("offers the guest boards with their titles", () => {
    storeGuest(guestWithThesis().getState().data);
    expect(findGuestBoardsToImport(USER)).toMatchObject({
      titles: ["My first board", "Thesis"],
      fingerprint: expect.any(String),
    });
  });

  it("offers nothing without guest boards, or for the untouched starter board", () => {
    expect(findGuestBoardsToImport(USER)).toBeNull();
    storeGuest(createWorkspaceState(new Date(2026, 10, 5)));
    expect(findGuestBoardsToImport(USER)).toBeNull();
    const empty = guestWithThesis();
    for (const id of empty.getState().data.boardOrder) empty.getState().actions.deleteBoard(id);
    storeGuest(empty.getState().data);
    expect(findGuestBoardsToImport(USER)).toBeNull();
  });

  it("ignores unreadable guest data and leaves it where it is", () => {
    localStorage.setItem(storageKey("workspace"), "{not json");
    expect(findGuestBoardsToImport(USER)).toBeNull();
    storeGuest({ version: 1, boards: "nope" });
    expect(findGuestBoardsToImport(USER)).toBeNull();
    expect(localStorage.getItem(storageKey("workspace"))).toContain("nope");
  });

  it("doesn't ask the same user again about handled data, until it changes", () => {
    const store = guestWithThesis();
    storeGuest(store.getState().data);
    const offer = findGuestBoardsToImport(USER)!;
    markGuestBoardsHandled(USER, offer.fingerprint);
    expect(localStorage.getItem(guestImportKey(USER))).toBe(offer.fingerprint);
    expect(findGuestBoardsToImport(USER)).toBeNull();
    expect(findGuestBoardsToImport("user-b")).not.toBeNull(); // another account still asks

    store.getState().actions.createBoard("Groceries");
    storeGuest(store.getState().data);
    expect(findGuestBoardsToImport(USER)?.titles).toEqual([
      "My first board",
      "Thesis",
      "Groceries",
    ]);
  });

  it("offers the demo-like boards a guest built", () => {
    storeGuest(createDemoState(new Date(2026, 10, 5)));
    expect(findGuestBoardsToImport(USER)?.titles).toEqual(["Launch my portfolio site 🚀"]);
  });
});

describe("clearGuestBoards", () => {
  it("removes only the guest workspace", () => {
    storeGuest(guestWithThesis().getState().data);
    localStorage.setItem(storageKey("demo"), "demo data");
    clearGuestBoards();
    expect(localStorage.getItem(storageKey("workspace"))).toBeNull();
    expect(localStorage.getItem(storageKey("demo"))).toBe("demo data");
  });
});
