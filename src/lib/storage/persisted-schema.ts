import { z } from "zod";
import { findIntegrityIssues } from "@/lib/domain/integrity";
import { LABEL_COLORS, PRIORITIES, STATE_VERSION, type PersistedState } from "@/lib/domain/types";

// Runtime validation for anything read back from storage. Never trust stored data:
// it may be from an older version, hand-edited, or truncated by a full disk.

const id = z.string().min(1).max(100);
const timestamp = z.string().min(1).max(40);

const labelSchema = z.object({
  id,
  name: z.string().max(40),
  color: z.enum(LABEL_COLORS),
});

const checklistItemSchema = z.object({
  id,
  title: z.string().max(300),
  done: z.boolean(),
  estimateMinutes: z.number().int().min(0).max(10_000).optional(),
  source: z.enum(["manual", "ai"]),
});

const cardSchema = z.object({
  id,
  boardId: id,
  columnId: id,
  title: z.string().min(1).max(300),
  description: z.string().max(10_000),
  priority: z.enum(PRIORITIES),
  labelIds: z.array(id).max(50),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  checklist: z.array(checklistItemSchema).max(200),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const columnSchema = z.object({
  id,
  boardId: id,
  title: z.string().min(1).max(100),
  cardIds: z.array(id),
  isDone: z.boolean().optional(),
});

const boardSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  columnIds: z.array(id),
  labels: z.array(labelSchema).max(50),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const persistedStateSchema = z.object({
  version: z.literal(STATE_VERSION),
  boards: z.record(id, boardSchema),
  columns: z.record(id, columnSchema),
  cards: z.record(id, cardSchema),
  boardOrder: z.array(id),
  activeBoardId: id.nullable(),
});

/**
 * Upgrades older stored shapes to the current version. Add a step here whenever
 * STATE_VERSION changes, e.g. `1: (v1) => ({ ...v1, version: 2, newField: [] })`.
 */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

function migrate(raw: unknown): unknown {
  let current = raw as Record<string, unknown>;
  while (
    current &&
    typeof current === "object" &&
    typeof current.version === "number" &&
    current.version < STATE_VERSION &&
    migrations[current.version]
  ) {
    current = migrations[current.version](current);
  }
  return current;
}

export type ParseResult = { ok: true; data: PersistedState } | { ok: false; reason: string };

/** Validates stored data: migrates, checks the schema, then checks cross-references. */
export function parsePersistedState(raw: unknown): ParseResult {
  const result = persistedStateSchema.safeParse(migrate(raw));
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, reason: `invalid shape at ${issue?.path.join(".") || "root"}` };
  }
  const issues = findIntegrityIssues(result.data);
  if (issues.length > 0) return { ok: false, reason: issues[0] };
  return { ok: true, data: result.data };
}
