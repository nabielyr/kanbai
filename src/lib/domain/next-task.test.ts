import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { moveCard, updateCard } from "./board-ops";
import {
  DUE_WEIGHT,
  IN_PROGRESS_BONUS,
  pickNextTask,
  PRIORITY_WEIGHT,
  scoreCard,
} from "./next-task";

// Demo board relative to NOW (see demo-seed.ts):
// To Do:       portfolio (high, +5d) · case-study (medium, +2d) · contact-bug (urgent, -1d)
//              hosting (low, no date)
// In Progress: hero (high, today) · ci (medium, +7d)
// Done:        palette (low, -3d) · domain (medium, no date)
const NOW = new Date(2026, 9, 23, 9, 0);
const ISO = NOW.toISOString();
const state = createDemoState(NOW);

describe("scoreCard", () => {
  it("adds priority, due urgency and the in-progress bonus, with reasons", () => {
    expect(scoreCard(state.cards["demo-card-hero"], { now: NOW, inProgress: true })).toEqual({
      cardId: "demo-card-hero",
      score: PRIORITY_WEIGHT.high + DUE_WEIGHT.today + IN_PROGRESS_BONUS,
      reasons: ["Due today", "High priority", "Already in progress"],
    });
    expect(scoreCard(state.cards["demo-card-hosting"], { now: NOW, inProgress: false })).toEqual({
      cardId: "demo-card-hosting",
      score: 0,
      reasons: [],
    });
  });
});

describe("pickNextTask", () => {
  it("picks the overdue urgent card on the demo board", () => {
    expect(pickNextTask(state, DEMO_BOARD_ID, NOW)).toEqual({
      cardId: "demo-card-contact-bug",
      score: PRIORITY_WEIGHT.urgent + DUE_WEIGHT.overdue,
      reasons: ["Overdue", "Urgent priority"],
    });
  });

  it("never suggests cards in done columns, even overdue ones", () => {
    let s = updateCard(state, {
      cardId: "demo-card-palette",
      patch: { priority: "urgent" },
      now: ISO,
    });
    s = moveCard(s, {
      cardId: "demo-card-contact-bug",
      toColumnId: "demo-col-done",
      beforeCardId: null,
      now: ISO,
    });
    // palette (urgent, overdue) and contact-bug are both in Done now; hero wins.
    expect(pickNextTask(s, DEMO_BOARD_ID, NOW)?.cardId).toBe("demo-card-hero");
  });

  it("only considers the given candidates (e.g. the filtered cards)", () => {
    const candidates = new Set(["demo-card-hosting", "demo-card-ci"]);
    expect(pickNextTask(state, DEMO_BOARD_ID, NOW, candidates)?.cardId).toBe("demo-card-ci");
  });

  it("breaks ties by the earlier due date, then by board position", () => {
    // portfolio: high, due in 5 days (30). case-study (placed after it): high, due in 4 days (30).
    let s = updateCard(state, {
      cardId: "demo-card-case-study",
      patch: { priority: "high", dueDate: "2026-10-27" },
      now: ISO,
    });
    const onlyTodo = new Set(["demo-card-portfolio", "demo-card-case-study"]);
    expect(pickNextTask(s, DEMO_BOARD_ID, NOW, onlyTodo)).toMatchObject({
      cardId: "demo-card-case-study",
      score: PRIORITY_WEIGHT.high + DUE_WEIGHT.later,
    });

    // Same score and same due date: the card placed first wins.
    s = updateCard(s, {
      cardId: "demo-card-portfolio",
      patch: { dueDate: "2026-10-27" },
      now: ISO,
    });
    expect(pickNextTask(s, DEMO_BOARD_ID, NOW, onlyTodo)?.cardId).toBe("demo-card-portfolio");
  });

  it("returns null when nothing is left or the board is unknown", () => {
    expect(pickNextTask(state, DEMO_BOARD_ID, NOW, new Set())).toBeNull();
    expect(pickNextTask(state, "nope", NOW)).toBeNull();
  });
});
