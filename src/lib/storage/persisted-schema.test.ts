import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo-seed";
import { parsePersistedState } from "./persisted-schema";

const valid = () => structuredClone(createDemoState(new Date(2026, 9, 24)));

describe("parsePersistedState", () => {
  it("accepts a valid state, including after a JSON round trip", () => {
    const state = valid();
    const result = parsePersistedState(JSON.parse(JSON.stringify(state)));
    expect(result).toEqual({ ok: true, data: state });
  });

  it("strips unknown fields", () => {
    const raw = { ...valid(), extra: "junk" };
    const result = parsePersistedState(raw);
    expect(result.ok && "extra" in result.data).toBe(false);
  });

  it.each([
    ["null", null],
    ["a string", "hello"],
    ["an unknown version", { ...valid(), version: 99 }],
  ])("rejects %s", (_label, raw) => {
    expect(parsePersistedState(raw).ok).toBe(false);
  });

  it("rejects a card with a malformed due date", () => {
    const raw = valid();
    (raw.cards["demo-card-hero"] as { dueDate: string }).dueDate = "tomorrow";
    const result = parsePersistedState(raw);
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("dueDate") });
  });

  it("rejects an unknown priority or label color", () => {
    const badPriority = valid();
    (badPriority.cards["demo-card-hero"] as { priority: string }).priority = "asap";
    expect(parsePersistedState(badPriority).ok).toBe(false);

    const badColor = valid();
    (badColor.boards["demo-board"].labels[0] as { color: string }).color = "neon";
    expect(parsePersistedState(badColor).ok).toBe(false);
  });

  it("rejects a well-shaped state whose references are broken", () => {
    const raw = valid();
    raw.columns["demo-col-todo"].cardIds.push("ghost");
    expect(parsePersistedState(raw)).toEqual({
      ok: false,
      reason: "column demo-col-todo references missing card ghost",
    });
  });
});
