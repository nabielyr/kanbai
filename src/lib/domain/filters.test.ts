import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { moveCard, updateCard } from "./board-ops";
import { getDropTarget, moveToColumn } from "./drag";
import {
  countFilterOptions,
  EMPTY_FILTERS,
  filterBoard,
  hasActiveFilters,
  type CardFilters,
} from "./filters";
import { findIntegrityIssues } from "./integrity";

// Demo board relative to NOW (see demo-seed.ts):
// To Do:       portfolio (dev+design, high, +5d) · case-study (content, medium, +2d)
//              contact-bug (bug, urgent, -1d) · hosting (research, low, no date)
// In Progress: hero (design, high, today) · ci (dev, medium, +7d)
// Done:        palette (design, low, -3d) · domain (research, medium, no date)
const NOW = new Date(2026, 9, 23, 9, 0);
const state = createDemoState(NOW);

const shownIds = (filters: Partial<CardFilters>, s = state) =>
  Object.values(filterBoard(s, DEMO_BOARD_ID, { ...EMPTY_FILTERS, ...filters }, NOW).visible)
    .flat()
    .map((id) => id.replace("demo-card-", ""));

describe("filterBoard", () => {
  it("shows everything, per column and in order, without filters", () => {
    const result = filterBoard(state, DEMO_BOARD_ID, EMPTY_FILTERS, NOW);
    expect(result.visible["demo-col-todo"]).toEqual(state.columns["demo-col-todo"].cardIds);
    expect(result).toMatchObject({ shown: 8, total: 8 });
  });

  it("searches title, description, labels and checklist, ignoring case and accents", () => {
    expect(shownIds({ query: "HERO" })).toEqual(["hero"]);
    expect(shownIds({ query: "keyboard" })).toEqual(["contact-bug"]);
    expect(shownIds({ query: "research" })).toEqual(["hosting", "domain"]);
    expect(shownIds({ query: "screenshots" })).toEqual(["case-study"]);
    expect(shownIds({ query: "  " })).toHaveLength(8);

    const accented = updateCard(state, {
      cardId: "demo-card-hosting",
      patch: { title: "Café hosting" },
      now: NOW.toISOString(),
    });
    expect(shownIds({ query: "cafe" }, accented)).toEqual(["hosting"]);
  });

  it("requires every search word to match", () => {
    expect(shownIds({ query: "contact mobile" })).toEqual(["contact-bug"]);
    expect(shownIds({ query: "contact hero" })).toEqual([]);
  });

  it("ORs options within a group", () => {
    expect(shownIds({ labelIds: ["demo-label-bug", "demo-label-content"] })).toEqual([
      "case-study",
      "contact-bug",
    ]);
    expect(shownIds({ priorities: ["urgent", "low"] })).toEqual([
      "contact-bug",
      "hosting",
      "palette",
    ]);
  });

  it("ANDs across groups", () => {
    expect(shownIds({ labelIds: ["demo-label-design"], priorities: ["high"] })).toEqual([
      "portfolio",
      "hero",
    ]);
    expect(
      shownIds({ labelIds: ["demo-label-design"], priorities: ["high"], query: "landing" }),
    ).toEqual(["hero"]);
  });

  it("filters by due status, never flagging done-column cards", () => {
    expect(shownIds({ due: ["overdue"] })).toEqual(["contact-bug"]); // palette is done
    expect(shownIds({ due: ["today", "soon"] })).toEqual(["case-study", "hero"]);
    expect(shownIds({ due: ["later"] })).toEqual(["portfolio", "ci"]);
    expect(shownIds({ due: ["none"] })).toEqual(["hosting", "domain"]);
  });

  it("counts shown and total cards", () => {
    const result = filterBoard(state, DEMO_BOARD_ID, { ...EMPTY_FILTERS, query: "design" }, NOW);
    expect(result.shown).toBe(3);
    expect(result.total).toBe(8);
    expect(result.visible["demo-col-done"]).toEqual(["demo-card-palette"]);
  });

  it("returns nothing for an unknown board", () => {
    expect(filterBoard(state, "nope", EMPTY_FILTERS, NOW)).toEqual({
      visible: {},
      shown: 0,
      total: 0,
    });
  });
});

describe("filter helpers", () => {
  it("knows when filters are active and counts chosen options", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: "  " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, due: ["none"] })).toBe(true);
    expect(
      countFilterOptions({ query: "x", labelIds: ["a"], priorities: ["low", "high"], due: [] }),
    ).toBe(3);
  });
});

describe("dragging while filtered", () => {
  it("keeps hidden cards in place when a visible card is dropped", () => {
    // Only "high" cards are visible: portfolio (To Do) and hero (In Progress).
    const filters = { ...EMPTY_FILTERS, priorities: ["high" as const] };
    const { visible } = filterBoard(state, DEMO_BOARD_ID, filters, NOW);
    expect(visible["demo-col-todo"]).toEqual(["demo-card-portfolio"]);

    // Drag hero onto portfolio in To Do, the way the board's drag handlers do.
    const preview = moveToColumn(visible, "demo-card-hero", "demo-card-portfolio");
    const target = getDropTarget(preview, "demo-card-hero")!;
    const next = moveCard(state, {
      cardId: "demo-card-hero",
      ...target,
      toColumnId: target.columnId,
      now: NOW.toISOString(),
    });

    expect(next.columns["demo-col-todo"].cardIds).toEqual([
      "demo-card-hero",
      "demo-card-portfolio",
      "demo-card-case-study",
      "demo-card-contact-bug",
      "demo-card-hosting",
    ]);
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("drops after the last visible card without jumping over hidden ones' order", () => {
    const filters = { ...EMPTY_FILTERS, priorities: ["high" as const] };
    const { visible } = filterBoard(state, DEMO_BOARD_ID, filters, NOW);
    const preview = moveToColumn(visible, "demo-card-hero", "demo-card-portfolio", true);
    const target = getDropTarget(preview, "demo-card-hero")!;
    expect(target).toEqual({ columnId: "demo-col-todo", beforeCardId: null });

    const next = moveCard(state, {
      cardId: "demo-card-hero",
      toColumnId: target.columnId,
      beforeCardId: null,
      now: NOW.toISOString(),
    });
    expect(next.columns["demo-col-todo"].cardIds.slice(0, 4)).toEqual(
      state.columns["demo-col-todo"].cardIds,
    );
    expect(next.columns["demo-col-todo"].cardIds.at(-1)).toBe("demo-card-hero");
  });
});
