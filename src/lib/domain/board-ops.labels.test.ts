import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import {
  addLabel,
  createBoard,
  deleteLabel,
  MAX_LABEL_NAME_LENGTH,
  MAX_LABELS_PER_BOARD,
  updateLabel,
} from "./board-ops";
import { findIntegrityIssues } from "./integrity";

const NOW = "2026-10-27T10:00:00.000Z";
const demo = () => createDemoState(new Date(2026, 9, 27));
const labelsOf = (state: ReturnType<typeof demo>) => state.boards[DEMO_BOARD_ID].labels;

describe("addLabel", () => {
  it("adds a cleaned label at the end and touches the board", () => {
    const state = addLabel(demo(), {
      boardId: DEMO_BOARD_ID,
      id: "l-new",
      name: "  needs   review ",
      color: "sage",
      now: NOW,
    });
    expect(labelsOf(state).at(-1)).toEqual({ id: "l-new", name: "needs review", color: "sage" });
    expect(state.boards[DEMO_BOARD_ID].updatedAt).toBe(NOW);
    expect(findIntegrityIssues(state)).toEqual([]);
  });

  it("truncates long names", () => {
    const state = addLabel(demo(), {
      boardId: DEMO_BOARD_ID,
      id: "l-new",
      name: "x".repeat(100),
      color: "sky",
      now: NOW,
    });
    expect(labelsOf(state).at(-1)?.name).toHaveLength(MAX_LABEL_NAME_LENGTH);
  });

  it("rejects blank names, duplicate names (any case), duplicate ids and unknown boards", () => {
    const state = demo();
    const base = { boardId: DEMO_BOARD_ID, id: "l-new", color: "sky" as const, now: NOW };
    expect(addLabel(state, { ...base, name: "   " })).toBe(state);
    expect(addLabel(state, { ...base, name: "BUG" })).toBe(state);
    expect(addLabel(state, { ...base, id: labelsOf(state)[0].id, name: "fresh" })).toBe(state);
    expect(addLabel(state, { ...base, boardId: "nope", name: "fresh" })).toBe(state);
  });

  it("rejects colors outside the palette", () => {
    const state = demo();
    const color = "neon" as unknown as "sky";
    expect(
      addLabel(state, { boardId: DEMO_BOARD_ID, id: "l", name: "fresh", color, now: NOW }),
    ).toBe(state);
  });

  it("stops at the per-board limit", () => {
    let state = demo();
    for (let i = labelsOf(state).length; i < MAX_LABELS_PER_BOARD; i++) {
      state = addLabel(state, {
        boardId: DEMO_BOARD_ID,
        id: `l-${i}`,
        name: `label ${i}`,
        color: "mint",
        now: NOW,
      });
    }
    expect(labelsOf(state)).toHaveLength(MAX_LABELS_PER_BOARD);
    const full = state;
    expect(
      addLabel(full, {
        boardId: DEMO_BOARD_ID,
        id: "l-x",
        name: "one more",
        color: "mint",
        now: NOW,
      }),
    ).toBe(full);
  });
});

describe("updateLabel", () => {
  it("renames and recolors a label in place", () => {
    const state = demo();
    const { id } = labelsOf(state)[0];
    const next = updateLabel(state, {
      boardId: DEMO_BOARD_ID,
      labelId: id,
      patch: { name: " UI ", color: "slate" },
      now: NOW,
    });
    expect(labelsOf(next)[0]).toEqual({ id, name: "UI", color: "slate" });
    expect(labelsOf(next)).toHaveLength(labelsOf(state).length);
    expect(next.boards[DEMO_BOARD_ID].updatedAt).toBe(NOW);
  });

  it("allows changing only the case of its own name", () => {
    const state = demo();
    const { id, name } = labelsOf(state)[0];
    const next = updateLabel(state, {
      boardId: DEMO_BOARD_ID,
      labelId: id,
      patch: { name: name.toUpperCase() },
      now: NOW,
    });
    expect(labelsOf(next)[0].name).toBe(name.toUpperCase());
  });

  it("rejects blank or duplicate names, no-op patches and unknown labels", () => {
    const state = demo();
    const [first, second] = labelsOf(state);
    const base = { boardId: DEMO_BOARD_ID, labelId: first.id, now: NOW };
    expect(updateLabel(state, { ...base, patch: { name: "  " } })).toBe(state);
    expect(updateLabel(state, { ...base, patch: { name: second.name } })).toBe(state);
    expect(updateLabel(state, { ...base, patch: { name: first.name, color: first.color } })).toBe(
      state,
    );
    expect(updateLabel(state, { ...base, labelId: "nope", patch: { name: "x" } })).toBe(state);
  });
});

describe("deleteLabel", () => {
  it("removes the label from the board and from every card that used it", () => {
    const state = demo();
    const used = Object.values(state.cards).find((c) => c.labelIds.length > 0)!;
    const labelId = used.labelIds[0];
    const users = Object.values(state.cards).filter((c) => c.labelIds.includes(labelId));

    const next = deleteLabel(state, { boardId: DEMO_BOARD_ID, labelId, now: NOW });

    expect(labelsOf(next).some((l) => l.id === labelId)).toBe(false);
    for (const card of users) {
      expect(next.cards[card.id].labelIds).not.toContain(labelId);
      expect(next.cards[card.id].updatedAt).toBe(NOW);
    }
    const untouched = Object.values(state.cards).find((c) => !c.labelIds.includes(labelId));
    if (untouched) expect(next.cards[untouched.id]).toBe(untouched);
    expect(findIntegrityIssues(next)).toEqual([]);
  });

  it("does not touch cards on other boards", () => {
    let state = createBoard(demo(), {
      id: "b2",
      title: "Other",
      columnIds: ["b2-c1", "b2-c2", "b2-c3"],
      now: NOW,
    });
    const before = state;
    state = deleteLabel(state, { boardId: "b2", labelId: "b2-label-bug", now: NOW });
    expect(state.cards).toEqual(before.cards);
    expect(state.boards.b2.labels.map((l) => l.name)).toEqual(["feature", "design", "idea"]);
  });

  it("ignores unknown boards and labels", () => {
    const state = demo();
    expect(deleteLabel(state, { boardId: "nope", labelId: "x", now: NOW })).toBe(state);
    expect(deleteLabel(state, { boardId: DEMO_BOARD_ID, labelId: "x", now: NOW })).toBe(state);
  });
});
