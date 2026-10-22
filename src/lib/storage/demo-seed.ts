import { addDays, format } from "date-fns";
import {
  STATE_VERSION,
  type Board,
  type Card,
  type ChecklistItem,
  type Column,
  type PersistedState,
  type Priority,
} from "@/lib/domain/types";

// Sample board for demo mode. IDs are fixed so "Reset demo" always produces the same board;
// due dates are relative to `now` so the overdue / today / soon indicators always show.

export const DEMO_BOARD_ID = "demo-board";

const LABELS = {
  design: { id: "demo-label-design", name: "design", color: "lilac" },
  dev: { id: "demo-label-dev", name: "dev", color: "sky" },
  content: { id: "demo-label-content", name: "content", color: "peach" },
  bug: { id: "demo-label-bug", name: "bug", color: "rose" },
  research: { id: "demo-label-research", name: "research", color: "mint" },
} satisfies Record<string, Board["labels"][number]>;

type LabelKey = keyof typeof LABELS;

interface CardSeed {
  key: string;
  title: string;
  description?: string;
  priority: Priority;
  labels: LabelKey[];
  /** Days from today, or null for no due date. */
  dueInDays: number | null;
  /** [title, done] pairs. */
  checklist?: [string, boolean][];
}

const COLUMNS: { key: string; title: string; isDone?: boolean; cards: CardSeed[] }[] = [
  {
    key: "todo",
    title: "To Do",
    cards: [
      {
        key: "portfolio",
        title: "Build my portfolio website",
        description:
          "Personal site to show my projects: home, about, project pages, contact form. " +
          "Feels huge — try the ✨ Chunk it button to break it down.",
        priority: "high",
        labels: ["dev", "design"],
        dueInDays: 5,
      },
      {
        key: "case-study",
        title: "Write a case study for KanbAI",
        description: "Problem, process, screenshots and what I learned.",
        priority: "medium",
        labels: ["content"],
        dueInDays: 2,
        checklist: [
          ["Outline the sections", true],
          ["Take screenshots", false],
          ["Write the first draft", false],
        ],
      },
      {
        key: "contact-bug",
        title: "Fix contact form on mobile",
        description: "The submit button is hidden behind the keyboard on small screens.",
        priority: "urgent",
        labels: ["bug"],
        dueInDays: -1,
      },
      {
        key: "hosting",
        title: "Compare free hosting options",
        priority: "low",
        labels: ["research"],
        dueInDays: null,
      },
    ],
  },
  {
    key: "doing",
    title: "In Progress",
    cards: [
      {
        key: "hero",
        title: "Design the landing page hero",
        priority: "high",
        labels: ["design"],
        dueInDays: 0,
        checklist: [
          ["Moodboard", true],
          ["Pick fonts", true],
          ["Headline copy", true],
          ["Hero illustration", false],
          ["Mobile layout", false],
        ],
      },
      {
        key: "ci",
        title: "Set up CI with GitHub Actions",
        priority: "medium",
        labels: ["dev"],
        dueInDays: 7,
        checklist: [
          ["Lint + typecheck job", true],
          ["Run tests on every push", false],
        ],
      },
    ],
  },
  {
    key: "done",
    title: "Done",
    isDone: true,
    cards: [
      {
        key: "palette",
        title: "Pick a color palette",
        priority: "low",
        labels: ["design"],
        dueInDays: -3,
        checklist: [
          ["Collect references", true],
          ["Test contrast", true],
          ["Define dark mode", true],
        ],
      },
      {
        key: "domain",
        title: "Buy a domain name",
        priority: "medium",
        labels: ["research"],
        dueInDays: null,
      },
    ],
  },
];

export function createDemoState(now: Date = new Date()): PersistedState {
  const timestamp = now.toISOString();
  const columns: Record<string, Column> = {};
  const cards: Record<string, Card> = {};

  for (const columnSeed of COLUMNS) {
    const columnId = `demo-col-${columnSeed.key}`;
    const cardIds: string[] = [];

    for (const seed of columnSeed.cards) {
      const cardId = `demo-card-${seed.key}`;
      cardIds.push(cardId);
      cards[cardId] = {
        id: cardId,
        boardId: DEMO_BOARD_ID,
        columnId,
        title: seed.title,
        description: seed.description ?? "",
        priority: seed.priority,
        labelIds: seed.labels.map((key) => LABELS[key].id),
        dueDate:
          seed.dueInDays === null ? null : format(addDays(now, seed.dueInDays), "yyyy-MM-dd"),
        checklist: (seed.checklist ?? []).map(([title, done], i): ChecklistItem => ({
          id: `${cardId}-item-${i + 1}`,
          title,
          done,
          source: "manual",
        })),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    columns[columnId] = {
      id: columnId,
      boardId: DEMO_BOARD_ID,
      title: columnSeed.title,
      cardIds,
      ...(columnSeed.isDone ? { isDone: true } : {}),
    };
  }

  const board: Board = {
    id: DEMO_BOARD_ID,
    title: "Launch my portfolio site 🚀",
    columnIds: Object.keys(columns),
    labels: Object.values(LABELS),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    version: STATE_VERSION,
    boards: { [board.id]: board },
    columns,
    cards,
    boardOrder: [board.id],
    activeBoardId: board.id,
  };
}
