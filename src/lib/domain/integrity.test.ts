import { describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/storage/demo-seed";
import { findIntegrityIssues } from "./integrity";

describe("findIntegrityIssues", () => {
  it("reports a card listed in a column that does not exist", () => {
    const state = createDemoState();
    state.columns["demo-col-todo"].cardIds.push("ghost");
    expect(findIntegrityIssues(state)).toContain(
      "column demo-col-todo references missing card ghost",
    );
  });

  it("reports a card whose columnId disagrees with its column", () => {
    const state = createDemoState();
    state.cards["demo-card-hosting"].columnId = "demo-col-done";
    expect(findIntegrityIssues(state)).toContain("card demo-card-hosting has wrong columnId");
  });

  it("reports a card listed in two columns", () => {
    const state = createDemoState();
    state.columns["demo-col-done"].cardIds.push("demo-card-hosting");
    expect(findIntegrityIssues(state)).toContain("card demo-card-hosting listed more than once");
  });

  it("reports orphaned cards and unknown labels", () => {
    const state = createDemoState();
    state.columns["demo-col-todo"].cardIds = state.columns["demo-col-todo"].cardIds.filter(
      (id) => id !== "demo-card-hosting",
    );
    state.cards["demo-card-hero"].labelIds.push("nope");
    const issues = findIntegrityIssues(state);
    expect(issues).toContain("card demo-card-hosting is orphaned");
    expect(issues).toContain("card demo-card-hero uses unknown label nope");
  });

  it("reports a dangling activeBoardId", () => {
    const state = createDemoState();
    state.activeBoardId = "missing";
    expect(findIntegrityIssues(state)).toContain("activeBoardId references missing board missing");
  });
});
