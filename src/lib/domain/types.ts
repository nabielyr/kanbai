// Core domain model. Pure data: no React, no storage, no framework imports.
// State is normalized into maps; ordering lives in id arrays (columnIds, cardIds).

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LABEL_COLORS = [
  "mint",
  "sky",
  "lilac",
  "peach",
  "lemon",
  "rose",
  "sage",
  "slate",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  /** Set when the item came from "Chunk it". */
  estimateMinutes?: number;
  source: "manual" | "ai";
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  labelIds: string[];
  /** Calendar date without time, `yyyy-MM-dd`, or null when not set. */
  dueDate: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  cardIds: string[];
  /** Cards in a "done" column never show due-date warnings. */
  isDone?: boolean;
}

export interface Board {
  id: string;
  title: string;
  columnIds: string[];
  labels: Label[];
  createdAt: string;
  updatedAt: string;
}

export const STATE_VERSION = 1;

export interface PersistedState {
  version: typeof STATE_VERSION;
  boards: Record<string, Board>;
  columns: Record<string, Column>;
  cards: Record<string, Card>;
  boardOrder: string[];
  activeBoardId: string | null;
}
