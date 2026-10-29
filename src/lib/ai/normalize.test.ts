import { describe, expect, it } from "vitest";
import {
  clampEstimate,
  cleanSubtaskTitle,
  DEFAULT_ESTIMATE_MINUTES,
  extractJson,
  MAX_RAW_LENGTH,
  normalizeChunkOutput,
  parseEstimate,
} from "./normalize";
import { MAX_SUBTASK_TITLE, MAX_SUBTASKS } from "./schemas";

const three = [
  { title: "Sketch the layout", estimateMinutes: 30, order: 1 },
  { title: "Write the copy", estimateMinutes: 45, order: 2 },
  { title: "Ship it", estimateMinutes: 15, order: 3 },
];
const json = (value: unknown) => JSON.stringify(value);

function expectOk(raw: string) {
  const result = normalizeChunkOutput(raw);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.subtasks;
}

describe("extractJson", () => {
  it("returns plain JSON as is", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("strips code fences and surrounding prose", () => {
    expect(extractJson('Here you go:\n```json\n{"a": [1, 2]}\n```\nGood luck!')).toBe(
      '{"a": [1, 2]}',
    );
    expect(extractJson('Sure! {"a": 1} Hope that helps.')).toBe('{"a": 1}');
    expect(extractJson("```\n[1, 2]\n```")).toBe("[1, 2]");
  });

  it("ignores brackets inside strings, including escaped quotes", () => {
    const text = '{"title": "Fix } and ] in \\"quotes\\"", "n": 1} trailing }';
    expect(extractJson(text)).toBe('{"title": "Fix } and ] in \\"quotes\\"", "n": 1}');
  });

  it("returns null when there is no complete JSON value", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson('{"subtasks": [{"title": "cut off')).toBeNull();
    expect(extractJson('{"a": [1, 2}')).toBeNull();
  });
});

describe("cleanSubtaskTitle", () => {
  it.each([
    ["  Write   the   intro ", "Write the intro"],
    ["1. Write the intro", "Write the intro"],
    ["2) Write the intro", "Write the intro"],
    ["- Write the intro", "Write the intro"],
    ["• Write the intro", "Write the intro"],
    ["Step 3: Write the intro", "Write the intro"],
    ['"Write the intro"', "Write the intro"],
    ["10-minute warm-up", "10-minute warm-up"],
    ["3D print the case", "3D print the case"],
    ["2026 budget review", "2026 budget review"],
  ])("%j → %j", (input, expected) => {
    expect(cleanSubtaskTitle(input)).toBe(expected);
  });

  it("shortens long titles at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(60);
    const cleaned = cleanSubtaskTitle(long);
    expect(cleaned.length).toBeLessThanOrEqual(MAX_SUBTASK_TITLE);
    expect(cleaned.endsWith("word…")).toBe(true);
  });
});

describe("parseEstimate and clampEstimate", () => {
  it.each([
    [30, 30],
    ["30", 30],
    ["30 min", 30],
    ["about 45 minutes", 45],
    ["1.5 hours", 90],
    ["2h", 120],
    ["1,5 h", 90],
    ["soon", null],
    [null, null],
    [Number.NaN, null],
  ])("parses %j as %j", (input, expected) => {
    expect(parseEstimate(input)).toBe(expected);
  });

  it.each([
    [0, 5],
    [-20, 5],
    [7, 5],
    [8, 10],
    [33, 35],
    [10_000, 480],
  ])("clamps %i to %i", (input, expected) => {
    expect(clampEstimate(input)).toBe(expected);
  });
});

describe("normalizeChunkOutput", () => {
  it("accepts a well-formed response", () => {
    expect(expectOk(json({ subtasks: three }))).toEqual(three);
  });

  it("accepts fenced output with prose around it", () => {
    const raw = `Here is the plan:\n\`\`\`json\n${json({ subtasks: three })}\n\`\`\``;
    expect(expectOk(raw)).toEqual(three);
  });

  it("accepts a bare array, other list keys, field aliases and plain strings", () => {
    expect(expectOk(json(three))).toHaveLength(3);
    expect(
      expectOk(
        json({
          steps: [
            { name: "Sketch the layout", minutes: "30 min" },
            { task: "Write the copy", estimate_minutes: 45 },
            "Ship it",
          ],
        }),
      ),
    ).toEqual([
      { title: "Sketch the layout", estimateMinutes: 30, order: 1 },
      { title: "Write the copy", estimateMinutes: 45, order: 2 },
      { title: "Ship it", estimateMinutes: DEFAULT_ESTIMATE_MINUTES, order: 3 },
    ]);
  });

  it("sorts by order and renumbers from 1", () => {
    const shuffled = [
      { title: "Third", estimateMinutes: 10, order: 30 },
      { title: "First", estimateMinutes: 10, order: 0 },
      { title: "Second", estimateMinutes: 10, order: 12 },
    ];
    expect(expectOk(json({ subtasks: shuffled })).map((s) => [s.order, s.title])).toEqual([
      [1, "First"],
      [2, "Second"],
      [3, "Third"],
    ]);
  });

  it("keeps the original order for ties and missing orders", () => {
    const items = [{ title: "Alpha" }, { title: "Bravo" }, { title: "Charlie" }];
    expect(expectOk(json({ subtasks: items })).map((s) => s.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("cleans titles, removes duplicates (ignoring case) and drops unusable items", () => {
    const items = [
      { title: "1. Write the copy", estimateMinutes: 20 },
      { title: "write THE copy", estimateMinutes: 25 },
      { title: "ok", estimateMinutes: 5 }, // too short
      { title: 42 }, // not a string
      null,
      { title: "Pick images", estimateMinutes: 15 },
      { title: "Publish", estimateMinutes: 10 },
    ];
    expect(expectOk(json({ subtasks: items })).map((s) => s.title)).toEqual([
      "Write the copy",
      "Pick images",
      "Publish",
    ]);
  });

  it("clamps and rounds estimates", () => {
    const items = [
      { title: "Tiny", estimateMinutes: 1 },
      { title: "Huge", estimateMinutes: 9000 },
      { title: "Odd", estimateMinutes: 22.4 },
    ];
    expect(expectOk(json({ subtasks: items })).map((s) => s.estimateMinutes)).toEqual([5, 480, 20]);
  });

  it("keeps at most the maximum number of subtasks", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `Task number ${i + 1}` }));
    const subtasks = expectOk(json({ subtasks: many }));
    expect(subtasks).toHaveLength(MAX_SUBTASKS);
    expect(subtasks.at(-1)).toMatchObject({ title: "Task number 8", order: 8 });
  });

  it.each([
    ["", "no JSON found"],
    ["I can't help with that.", "no JSON found"],
    ["{'subtasks': []}", "invalid JSON"],
    [json({ result: "nope" }), "no subtask list"],
    [json({ subtasks: three.slice(0, 2) }), "too few subtasks (2)"],
    [
      json({ subtasks: [...three.slice(0, 2), { ...three[0], title: "SKETCH the layout" }] }),
      "too few subtasks (2)",
    ],
    ["x".repeat(MAX_RAW_LENGTH + 1), "response too long"],
  ])("rejects %j (%s)", (raw, reason) => {
    expect(normalizeChunkOutput(raw)).toEqual({ ok: false, reason });
  });

  it("treats injected HTML as plain text (rendering escapes it)", () => {
    const items = [
      { title: "<img src=x onerror=alert(1)>" },
      { title: "Write the copy" },
      { title: "Publish" },
    ];
    expect(expectOk(json({ subtasks: items }))[0].title).toBe("<img src=x onerror=alert(1)>");
  });
});
