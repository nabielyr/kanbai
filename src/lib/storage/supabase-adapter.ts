import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { STATE_VERSION, type PersistedState } from "@/lib/domain/types";
import {
  StorageConflictError,
  StorageError,
  type LoadResult,
  type StorageAdapter,
} from "./adapter";
import { boardSchema, cardSchema, columnSchema, parsePersistedState } from "./persisted-schema";

// A signed-in user's boards, one row per board in `public.boards` (supabase/migrations).
// Only boards that changed are written, and every write is guarded by the row's `rev`:
// if another device saved first, nothing is overwritten and the app reloads instead.

const TABLE = "boards";
const REQUEST_TIMEOUT_MS = 15_000;
/** How often an open, visible tab checks for changes made on another device. */
export const REMOTE_POLL_INTERVAL_MS = 30_000;
/** Focus and visibility events often fire together; one check covers both. */
const MIN_CHECK_GAP_MS = 5_000;

/** What one row's `data` column holds: a single board with its columns and cards. */
const boardDocumentSchema = z.object({
  version: z.literal(STATE_VERSION),
  board: boardSchema,
  columns: z.record(z.string(), columnSchema),
  cards: z.record(z.string(), cardSchema),
});

type BoardDocument = z.infer<typeof boardDocumentSchema>;

interface BoardRow {
  id: string;
  position: number;
  data: unknown;
  rev: number;
}

/** The version of a board this device last read or wrote. */
interface SyncedBoard {
  rev: number;
  fingerprint: string;
}

export function activeBoardKey(userId: string): string {
  return `kanbai:v1:account:${userId}:active-board`;
}

function toDocument(state: PersistedState, boardId: string): BoardDocument {
  const board = state.boards[boardId];
  const columns: BoardDocument["columns"] = {};
  const cards: BoardDocument["cards"] = {};
  for (const columnId of board.columnIds) {
    const column = state.columns[columnId];
    if (!column) continue;
    columns[columnId] = column;
    for (const cardId of column.cardIds) {
      const card = state.cards[cardId];
      if (card) cards[cardId] = card;
    }
  }
  return { version: STATE_VERSION, board, columns, cards };
}

function fingerprint(position: number, doc: BoardDocument): string {
  return JSON.stringify([position, doc]);
}

/** Reads one row's board, or null if it's unreadable (or from a newer version of the app). */
function readDocument(row: BoardRow): BoardDocument | null {
  const parsed = boardDocumentSchema.safeParse(row.data);
  if (!parsed.success || parsed.data.board.id !== row.id) return null;
  const doc = parsed.data;
  const alone = parsePersistedState({
    version: STATE_VERSION,
    boards: { [row.id]: doc.board },
    columns: doc.columns,
    cards: doc.cards,
    boardOrder: [row.id],
    activeBoardId: row.id,
  });
  return alone.ok ? doc : null;
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createSupabaseAdapter(
  client: SupabaseClient,
  userId: string,
  storage: Storage | null = browserStorage(),
): StorageAdapter {
  const synced = new Map<string, SyncedBoard>();
  /** Unreadable rows: never written or deleted, only remembered so they don't look "new". */
  const skipped = new Map<string, number>();
  const activeKey = activeBoardKey(userId);

  // One request batch at a time, so two saves never race each other with the same rev.
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  // Which board is open is a per-device choice, so it stays in this browser.
  function readActiveBoard(): string | null {
    try {
      return storage?.getItem(activeKey) ?? null;
    } catch {
      return null;
    }
  }
  function writeActiveBoard(boardId: string | null) {
    try {
      if (boardId) storage?.setItem(activeKey, boardId);
      else storage?.removeItem(activeKey);
    } catch {
      // Not remembering the open board is fine.
    }
  }

  async function loadNow(): Promise<LoadResult> {
    const { data, error } = await client
      .from(TABLE)
      .select("id, position, data, rev")
      .eq("user_id", userId)
      .order("position")
      .order("id")
      .abortSignal(requestSignal());
    if (error) throw new StorageError("Could not load your boards", error);

    synced.clear();
    skipped.clear();
    const rows = (data ?? []) as BoardRow[];
    if (rows.length === 0) return { status: "empty" };

    const state: PersistedState = {
      version: STATE_VERSION,
      boards: {},
      columns: {},
      cards: {},
      boardOrder: [],
      activeBoardId: null,
    };
    const loaded = new Map<string, BoardRow>();

    for (const row of rows) {
      const doc = readDocument(row);
      const clashes =
        doc &&
        (Object.keys(doc.columns).some((id) => state.columns[id]) ||
          Object.keys(doc.cards).some((id) => state.cards[id]));
      if (!doc || clashes) {
        skipped.set(row.id, row.rev);
        continue;
      }
      state.boards[row.id] = doc.board;
      Object.assign(state.columns, doc.columns);
      Object.assign(state.cards, doc.cards);
      state.boardOrder.push(row.id);
      loaded.set(row.id, row);
    }

    const remembered = readActiveBoard();
    state.activeBoardId =
      remembered && state.boards[remembered] ? remembered : (state.boardOrder[0] ?? null);

    // Fingerprint the assembled state, which is exactly what the store will start from.
    for (const [boardId, row] of loaded) {
      synced.set(boardId, {
        rev: row.rev,
        fingerprint: fingerprint(row.position, toDocument(state, boardId)),
      });
    }

    return { status: "ok", data: state, skippedBoards: skipped.size || undefined };
  }

  async function saveNow(state: PersistedState): Promise<void> {
    writeActiveBoard(state.activeBoardId);

    const conflicts: string[] = [];
    const failures: unknown[] = [];

    const insert = async (boardId: string, position: number, doc: BoardDocument, fp: string) => {
      const { data, error } = await client
        .from(TABLE)
        .insert({ id: boardId, title: doc.board.title, position, data: doc })
        .select("rev")
        .abortSignal(requestSignal())
        .single();
      if (error?.code === "23505") conflicts.push(boardId);
      else if (error || !data) failures.push(error);
      else synced.set(boardId, { rev: data.rev, fingerprint: fp });
    };

    const update = async (
      boardId: string,
      known: SyncedBoard,
      position: number,
      doc: BoardDocument,
      fp: string,
    ) => {
      const { data, error } = await client
        .from(TABLE)
        .update({ title: doc.board.title, position, data: doc })
        .eq("user_id", userId)
        .eq("id", boardId)
        .eq("rev", known.rev)
        .select("rev")
        .abortSignal(requestSignal())
        .maybeSingle();
      if (error) failures.push(error);
      else if (!data) conflicts.push(boardId);
      else synced.set(boardId, { rev: data.rev, fingerprint: fp });
    };

    const remove = async (boardId: string, known: SyncedBoard) => {
      const { data, error } = await client
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("id", boardId)
        .eq("rev", known.rev)
        .select("id")
        .abortSignal(requestSignal());
      if (error) failures.push(error);
      else if (!data?.length) conflicts.push(boardId);
      else synced.delete(boardId);
    };

    const writes: Promise<void>[] = [];
    state.boardOrder.forEach((boardId, position) => {
      const doc = toDocument(state, boardId);
      const fp = fingerprint(position, doc);
      const known = synced.get(boardId);
      if (known?.fingerprint === fp) return;
      writes.push(
        known ? update(boardId, known, position, doc, fp) : insert(boardId, position, doc, fp),
      );
    });
    for (const [boardId, known] of synced) {
      if (!state.boards[boardId]) writes.push(remove(boardId, known));
    }

    await Promise.all(writes.map((write) => write.catch((error: unknown) => failures.push(error))));
    if (failures.length > 0) throw new StorageError("Could not save your boards", failures[0]);
    if (conflicts.length > 0) throw new StorageConflictError(conflicts);
  }

  /** Cheap check (ids and revs only) for boards added, changed, or deleted elsewhere. */
  async function hasRemoteChanges(): Promise<boolean> {
    const { data, error } = await client
      .from(TABLE)
      .select("id, rev")
      .eq("user_id", userId)
      .abortSignal(requestSignal());
    if (error || !data) return false;
    const remote = data as { id: string; rev: number }[];
    if (remote.length !== synced.size + skipped.size) return true;
    return remote.some((row) => (synced.get(row.id)?.rev ?? skipped.get(row.id)) !== row.rev);
  }

  return {
    remote: true,

    load: () => enqueue(loadNow),

    save: (state) => enqueue(() => saveNow(state)),

    /** Forgets what this device knows. Never deletes anything from the account. */
    async clear() {
      await enqueue(async () => {
        synced.clear();
        skipped.clear();
        writeActiveBoard(null);
      });
    },

    subscribe(onExternalChange) {
      if (typeof window === "undefined") return () => {};
      let stopped = false;
      let lastCheck = -Infinity;

      const check = async () => {
        if (stopped || document.visibilityState === "hidden") return;
        const now = Date.now();
        if (now - lastCheck < MIN_CHECK_GAP_MS) return;
        lastCheck = now;
        const changed = await enqueue(hasRemoteChanges).catch(() => false);
        if (changed && !stopped) onExternalChange();
      };
      const onFocus = () => void check();
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") void check();
      };

      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const interval = setInterval(onFocus, REMOTE_POLL_INTERVAL_MS);
      return () => {
        stopped = true;
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        clearInterval(interval);
      };
    },
  };
}
