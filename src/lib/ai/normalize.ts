import {
  MAX_ESTIMATE_MINUTES,
  MAX_SUBTASK_TITLE,
  MAX_SUBTASKS,
  MIN_ESTIMATE_MINUTES,
  MIN_SUBTASK_TITLE,
  MIN_SUBTASKS,
  subtaskListSchema,
  type Subtask,
} from "./schemas";

// Turns raw LLM text into a clean, validated subtask list. Models are told to return
// `{ "subtasks": [{ "title", "estimateMinutes", "order" }] }`, but in practice they wrap it in
// code fences, add a sentence around it, rename fields or number the titles. We accept those
// variations, then the strict Zod schema has the final say. Pure: no network, no clock.

export type NormalizeResult = { ok: true; subtasks: Subtask[] } | { ok: false; reason: string };

/** Longer outputs are not a subtask list; refuse before parsing. */
export const MAX_RAW_LENGTH = 20_000;
/** Used when an item has no usable estimate. */
export const DEFAULT_ESTIMATE_MINUTES = 15;

const LIST_KEYS = ["subtasks", "tasks", "steps", "items"] as const;
const TITLE_KEYS = ["title", "name", "task", "step", "text"] as const;
const ESTIMATE_KEYS = ["estimateMinutes", "estimate_minutes", "minutes", "estimate"] as const;

/**
 * Finds the first JSON object or array in `raw`, ignoring code fences and surrounding prose.
 * Brackets inside strings are skipped, so `{"title": "Fix }"}` is extracted whole.
 */
export function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = fenced ? fenced[1] : raw;

  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char === "{" ? "}" : "]");
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) return null; // mismatched brackets
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null; // never closed, e.g. a truncated response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstOf(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function findList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return null;
  for (const key of LIST_KEYS) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

/** Removes list markers ("1.", "-", "Step 2:"), quotes and extra spaces; caps the length. */
export function cleanSubtaskTitle(title: string): string {
  let text = title
    .replace(/^\s*(?:step\s*\d+\s*[:.)-]?\s*|\d+[.):]\s+|[-*•–]+\s*)/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  if (text.length > MAX_SUBTASK_TITLE) {
    const cut = text.slice(0, MAX_SUBTASK_TITLE - 1);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${(lastSpace > MAX_SUBTASK_TITLE * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  return text;
}

/** Reads minutes from a number or text such as "30", "30 min", "1.5 hours" or "2h". */
export function parseEstimate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?\b/i.exec(
    value,
  );
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return /^h/i.test(match[2] ?? "") ? amount * 60 : amount;
}

/** Rounds to the nearest 5 minutes and keeps it within the allowed range. */
export function clampEstimate(minutes: number): number {
  const rounded = Math.round(minutes / 5) * 5;
  return Math.min(MAX_ESTIMATE_MINUTES, Math.max(MIN_ESTIMATE_MINUTES, rounded));
}

interface Candidate {
  title: string;
  estimateMinutes: number;
  order: number;
  index: number;
}

function toCandidate(item: unknown, index: number): Candidate | null {
  const record = typeof item === "string" ? { title: item } : isRecord(item) ? item : null;
  if (!record) return null;

  const rawTitle = firstOf(record, TITLE_KEYS);
  if (typeof rawTitle !== "string") return null;
  const title = cleanSubtaskTitle(rawTitle);
  if (title.length < MIN_SUBTASK_TITLE) return null;

  const estimate = parseEstimate(firstOf(record, ESTIMATE_KEYS));
  const order =
    typeof record.order === "number" && Number.isFinite(record.order) ? record.order : null;
  return {
    title,
    estimateMinutes: clampEstimate(estimate ?? DEFAULT_ESTIMATE_MINUTES),
    order: order ?? index + 1,
    index,
  };
}

/**
 * Parses and normalizes raw model output: sorted by `order` and renumbered 1..n,
 * titles cleaned and de-duplicated (ignoring case), estimates clamped, at most
 * MAX_SUBTASKS kept. Fails when fewer than MIN_SUBTASKS usable items remain.
 */
export function normalizeChunkOutput(raw: string): NormalizeResult {
  if (raw.length > MAX_RAW_LENGTH) return { ok: false, reason: "response too long" };

  const json = extractJson(raw);
  if (json === null) return { ok: false, reason: "no JSON found" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }

  const list = findList(parsed);
  if (!list) return { ok: false, reason: "no subtask list" };

  const seen = new Set<string>();
  const candidates = list
    .map(toCandidate)
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .filter((c) => {
      const key = c.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUBTASKS);

  if (candidates.length < MIN_SUBTASKS) {
    return { ok: false, reason: `too few subtasks (${candidates.length})` };
  }

  const subtasks = candidates.map((c, i) => ({
    title: c.title,
    estimateMinutes: c.estimateMinutes,
    order: i + 1,
  }));
  // Safety net: everything above should already guarantee this.
  const checked = subtaskListSchema.safeParse(subtasks);
  return checked.success
    ? { ok: true, subtasks: checked.data }
    : { ok: false, reason: "failed final validation" };
}
