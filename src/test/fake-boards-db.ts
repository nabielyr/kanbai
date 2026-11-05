import type { SupabaseClient } from "@supabase/supabase-js";

// An in-memory stand-in for the `public.boards` table behind Supabase's query builder.
// It mimics what the adapter relies on: row level security (each client only sees its own
// user's rows), the rev trigger, the (user_id, id) primary key, and jsonb reordering keys.

export interface FakeBoardRow {
  user_id: string;
  id: string;
  title: string;
  position: number;
  data: unknown;
  rev: number;
  [column: string]: unknown;
}

interface QueryError {
  message: string;
  code: string;
}

type Op = "select" | "insert" | "update" | "delete";

/** jsonb stores object keys sorted by length, then bytewise; the app must not depend on order. */
function asJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asJsonb);
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return Object.fromEntries(
      keys.map((key) => [key, asJsonb((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function createFakeBoardsDb() {
  const rows: FakeBoardRow[] = [];
  const requests: { op: Op; userId: string; id?: string }[] = [];
  let failures: QueryError[] = [];

  function pick(row: FakeBoardRow, columns: string) {
    if (columns.trim() === "*") return structuredClone(row);
    return Object.fromEntries(
      columns.split(",").map((c) => [c.trim(), structuredClone(row[c.trim()])]),
    );
  }

  class FakeQuery {
    private op: Op = "select";
    private columns = "*";
    private returning: string | null = null;
    private values: Record<string, unknown> = {};
    private filters: [string, unknown][] = [];
    private mode: "many" | "single" | "maybe" = "many";

    constructor(private readonly userId: string) {}

    select(columns = "*") {
      if (this.op === "select") this.columns = columns;
      else this.returning = columns;
      return this;
    }
    insert(values: Record<string, unknown>) {
      this.op = "insert";
      this.values = values;
      return this;
    }
    update(values: Record<string, unknown>) {
      this.op = "update";
      this.values = values;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    order() {
      return this;
    }
    abortSignal() {
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    maybeSingle() {
      this.mode = "maybe";
      return this;
    }

    then<T>(
      resolve: (value: { data: unknown; error: QueryError | null }) => T,
      reject?: (reason: unknown) => T,
    ) {
      return Promise.resolve()
        .then(() => this.run())
        .then(resolve, reject);
    }

    private matches(row: FakeBoardRow) {
      // Row level security: only the signed-in user's rows exist for this client.
      return row.user_id === this.userId && this.filters.every(([c, v]) => row[c] === v);
    }

    private run(): { data: unknown; error: QueryError | null } {
      requests.push({ op: this.op, userId: this.userId, id: this.values.id as string });
      const failure = failures.shift();
      if (failure) return { data: null, error: failure };

      let affected: FakeBoardRow[] = [];
      if (this.op === "select") {
        affected = rows
          .filter((row) => this.matches(row))
          .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
        return this.shape(affected, this.columns);
      }
      if (this.op === "insert") {
        const id = this.values.id as string;
        if (rows.some((row) => row.user_id === this.userId && row.id === id)) {
          return { data: null, error: { message: "duplicate key", code: "23505" } };
        }
        const row: FakeBoardRow = {
          id,
          title: this.values.title as string,
          position: this.values.position as number,
          data: asJsonb(structuredClone(this.values.data)),
          user_id: this.userId,
          rev: 1,
        };
        rows.push(row);
        affected = [row];
      } else if (this.op === "update") {
        affected = rows.filter((row) => this.matches(row));
        for (const row of affected) {
          Object.assign(row, structuredClone(this.values), { rev: row.rev + 1 });
          row.data = asJsonb(row.data);
        }
      } else {
        affected = rows.filter((row) => this.matches(row));
        for (const row of affected) rows.splice(rows.indexOf(row), 1);
      }
      if (this.returning === null) return { data: null, error: null };
      return this.shape(affected, this.returning);
    }

    private shape(found: FakeBoardRow[], columns: string) {
      const picked = found.map((row) => pick(row, columns));
      if (this.mode === "many") return { data: picked, error: null };
      if (picked.length > 1)
        return { data: null, error: { message: "many rows", code: "PGRST116" } };
      if (picked.length === 0 && this.mode === "single") {
        return { data: null, error: { message: "no rows", code: "PGRST116" } };
      }
      return { data: picked[0] ?? null, error: null };
    }
  }

  return {
    rows,
    requests,
    /** A client signed in as `userId`. */
    clientFor(userId: string): SupabaseClient {
      return { from: () => new FakeQuery(userId) } as unknown as SupabaseClient;
    },
    /** The next `count` requests fail like a dropped connection. */
    failNext(count = 1, error: QueryError = { message: "TypeError: Failed to fetch", code: "" }) {
      failures = Array.from({ length: count }, () => error);
    },
    /** Rows of one user, as stored. */
    rowsOf(userId: string) {
      return rows.filter((row) => row.user_id === userId);
    },
  };
}

export type FakeBoardsDb = ReturnType<typeof createFakeBoardsDb>;
