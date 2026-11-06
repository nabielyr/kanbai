import { beforeEach, describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/storage/demo-seed";
import {
  clearPendingChunk,
  findPendingCard,
  PENDING_CHUNK_KEY,
  PENDING_CHUNK_TTL_MS,
  readPendingChunk,
  remapPendingChunk,
  savePendingChunk,
  type PendingChunk,
} from "./pending-chunk";

const CHUNK = {
  cardId: "demo-card-portfolio",
  cardTitle: "Build my portfolio website",
  detail: "detailed",
  path: "/demo",
} as const;

beforeEach(() => localStorage.clear());

describe("pending chunk", () => {
  it("is saved, read back and cleared", () => {
    savePendingChunk(CHUNK, 1000);
    expect(readPendingChunk(2000)).toEqual({ ...CHUNK, savedAt: 1000 });
    clearPendingChunk();
    expect(readPendingChunk(2000)).toBeNull();
  });

  it("expires after 30 minutes and drops unreadable values", () => {
    savePendingChunk(CHUNK, 0);
    expect(readPendingChunk(PENDING_CHUNK_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem(PENDING_CHUNK_KEY)).toBeNull();

    localStorage.setItem(PENDING_CHUNK_KEY, "{not json");
    expect(readPendingChunk()).toBeNull();
    localStorage.setItem(PENDING_CHUNK_KEY, JSON.stringify({ cardId: "x" }));
    expect(readPendingChunk()).toBeNull();
    expect(localStorage.getItem(PENDING_CHUNK_KEY)).toBeNull();
  });

  it("follows the card to its imported copy", () => {
    savePendingChunk(CHUNK, 1000);
    remapPendingChunk({ other: "x", [CHUNK.cardId]: "acct-7" }, 1000);
    expect(readPendingChunk(1000)?.cardId).toBe("acct-7");

    remapPendingChunk({ unrelated: "y" }, 1000);
    expect(readPendingChunk(1000)?.cardId).toBe("acct-7");
  });
});

describe("findPendingCard", () => {
  const data = createDemoState(new Date(2026, 10, 6));
  const pending: PendingChunk = { ...CHUNK, savedAt: 0 };

  it("finds the card by id", () => {
    expect(findPendingCard(data, pending, false)).toBe(CHUNK.cardId);
  });

  it("falls back to the same title on the active board only when allowed", () => {
    const moved = { ...pending, cardId: "gone" };
    expect(findPendingCard(data, moved, false)).toBeNull();
    expect(findPendingCard(data, moved, true)).toBe(CHUNK.cardId);
    expect(findPendingCard(data, { ...moved, cardTitle: "Nope" }, true)).toBeNull();
  });
});
