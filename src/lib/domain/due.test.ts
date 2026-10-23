import { describe, expect, it } from "vitest";
import { getDueLabel, getDueStatus } from "./due";

// 23 Oct 2026, late evening local time — a classic spot for timezone off-by-one bugs.
const NOW = new Date(2026, 9, 23, 23, 45);

describe("getDueStatus", () => {
  it.each([
    [null, "none"],
    ["2026-10-22", "overdue"],
    ["2026-01-01", "overdue"],
    ["2026-10-23", "today"],
    ["2026-10-24", "soon"],
    ["2026-10-25", "soon"],
    ["2026-10-26", "later"],
    ["not-a-date", "none"],
  ] as const)("%s → %s", (dueDate, expected) => {
    expect(getDueStatus(dueDate, NOW)).toBe(expected);
  });

  it("treats the due date as a local calendar day at any time of day", () => {
    expect(getDueStatus("2026-10-23", new Date(2026, 9, 23, 0, 1))).toBe("today");
    expect(getDueStatus("2026-10-23", new Date(2026, 9, 23, 23, 59))).toBe("today");
  });

  it("never flags cards in a done column", () => {
    expect(getDueStatus("2026-10-01", NOW, true)).toBe("none");
  });
});

describe("getDueLabel", () => {
  it.each([
    ["2026-10-22", "Overdue · yesterday"],
    ["2026-10-19", "Overdue · Oct 19"],
    ["2026-10-23", "Today"],
    ["2026-10-24", "Tomorrow"],
    ["2026-10-25", "In 2 days"],
    ["2026-10-29", "Oct 29"],
  ])("%s → %s", (dueDate, expected) => {
    expect(getDueLabel(dueDate, NOW)).toBe(expected);
  });

  it("shows a plain date for done cards", () => {
    expect(getDueLabel("2026-10-19", NOW, true)).toBe("Oct 19");
  });
});
