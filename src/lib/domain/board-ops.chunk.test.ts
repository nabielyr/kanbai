import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { applyChunkAsCards, applyChunkAsChecklist, createBoard, type ChunkStep } from "./board-ops";
import { MAX_CHECKLIST_ITEMS } from "./checklist";
import { findIntegrityIssues } from "./integrity";

const NOW = "2026-11-01T10:00:00.000Z";
const state = createDemoState(new Date(2026, 10, 1));
const PARENT = "demo-card-portfolio"; // labels dev + design, priority high, in To Do
const steps: ChunkStep[] = [
  { title: "Pick a site template", estimateMinutes: 20 },
  { title: "Write the about page", estimateMinutes: 60 },
  { title: "Deploy to Vercel", estimateMinutes: 25 },
];
const ids = (prefix: string, n = steps.length) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe("applyChunkAsChecklist", () => {
  it("appends the steps as unchecked AI items with estimates", () => {
    const before = state.cards[PARENT].checklist;
    const next = applyChunkAsChecklist(state, {
      cardId: PARENT,
      steps,
      itemIds: ids("i"),
      now: NOW,
    });
    const checklist = next.cards[PARENT].checklist;

    expect(checklist.slice(0, before.length)).toEqual(before);
    expect(checklist.slice(before.length)).toEqual([
      { id: "i1", title: "Pick a site template", done: false, estimateMinutes: 20, source: "ai" },
      { id: "i2", title: "Write the about page", done: false, estimateMinutes: 60, source: "ai" },
      { id: "i3", title: "Deploy to Vercel", done: false, estimateMinutes: 25, source: "ai" },
    ]);
    expect(next.cards[PARENT].updatedAt).toBe(NOW);
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("skips blank titles and stops at the checklist limit", () => {
    const withBlank = applyChunkAsChecklist(state, {
      cardId: "demo-card-hosting",
      steps: [{ title: "  ", estimateMinutes: 5 }, ...steps],
      itemIds: ids("i", 4),
      now: NOW,
    });
    expect(withBlank.cards["demo-card-hosting"].checklist.map((i) => i.title)).toEqual(
      steps.map((s) => s.title),
    );

    const almostFull = applyChunkAsChecklist(state, {
      cardId: "demo-card-hosting",
      steps: Array.from({ length: MAX_CHECKLIST_ITEMS - 1 }, (_, i) => ({
        title: `t${i}`,
        estimateMinutes: 5,
      })),
      itemIds: ids("f", MAX_CHECKLIST_ITEMS - 1),
      now: NOW,
    });
    const capped = applyChunkAsChecklist(almostFull, {
      cardId: "demo-card-hosting",
      steps,
      itemIds: ids("i"),
      now: NOW,
    });
    expect(capped.cards["demo-card-hosting"].checklist).toHaveLength(MAX_CHECKLIST_ITEMS);
    expect(
      applyChunkAsChecklist(capped, {
        cardId: "demo-card-hosting",
        steps,
        itemIds: ids("x"),
        now: NOW,
      }),
    ).toBe(capped);
  });

  it("rejects unknown cards, mismatched or duplicate ids and empty input", () => {
    const base = { cardId: PARENT, steps, itemIds: ids("i"), now: NOW };
    expect(applyChunkAsChecklist(state, { ...base, cardId: "nope" })).toBe(state);
    expect(applyChunkAsChecklist(state, { ...base, itemIds: ["a", "b"] })).toBe(state);
    expect(applyChunkAsChecklist(state, { ...base, itemIds: ["a", "a", "b"] })).toBe(state);
    const caseStudy = { ...base, cardId: "demo-card-case-study" };
    const existing = state.cards["demo-card-case-study"].checklist[0].id;
    expect(applyChunkAsChecklist(state, { ...caseStudy, itemIds: [existing, "b", "c"] })).toBe(
      state,
    );
    expect(applyChunkAsChecklist(state, { ...base, steps: [], itemIds: [] })).toBe(state);
  });
});

describe("applyChunkAsCards", () => {
  it("creates cards at the bottom of the column, inheriting labels and priority", () => {
    const todoBefore = state.columns["demo-col-doing"].cardIds;
    const next = applyChunkAsCards(state, {
      parentCardId: PARENT,
      columnId: "demo-col-doing",
      steps,
      cardIds: ids("c"),
      now: NOW,
    });

    expect(next.columns["demo-col-doing"].cardIds).toEqual([...todoBefore, "c1", "c2", "c3"]);
    expect(next.cards.c2).toMatchObject({
      title: "Write the about page",
      boardId: DEMO_BOARD_ID,
      columnId: "demo-col-doing",
      priority: "high",
      labelIds: ["demo-label-dev", "demo-label-design"],
      description: "from: Build my portfolio website\nEstimate: 60 min",
      createdAt: NOW,
    });
    expect(next.cards[PARENT]).toBe(state.cards[PARENT]);
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("rejects another board's column, existing or duplicate ids and empty input", () => {
    const withOther = createBoard(state, {
      id: "b2",
      title: "Other",
      columnIds: ["b2-c1", "b2-c2", "b2-c3"],
      now: NOW,
    });
    const base = {
      parentCardId: PARENT,
      columnId: "demo-col-todo",
      steps,
      cardIds: ids("c"),
      now: NOW,
    };
    expect(applyChunkAsCards(withOther, { ...base, columnId: "b2-c1" })).toBe(withOther);
    expect(applyChunkAsCards(state, { ...base, parentCardId: "nope" })).toBe(state);
    expect(applyChunkAsCards(state, { ...base, columnId: "nope" })).toBe(state);
    expect(applyChunkAsCards(state, { ...base, cardIds: [PARENT, "c2", "c3"] })).toBe(state);
    expect(applyChunkAsCards(state, { ...base, cardIds: ["c1", "c1", "c3"] })).toBe(state);
    expect(applyChunkAsCards(state, { ...base, steps: [], cardIds: [] })).toBe(state);
  });
});
