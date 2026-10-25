"use client";

import { BoardWorkspace } from "@/components/board/board-workspace";
import { createWorkspaceState } from "@/lib/storage/workspace-seed";

const createInitialData = () => createWorkspaceState();

/** The visitor's own boards, saved in this browser. */
export function WorkspaceBoard() {
  return <BoardWorkspace namespace="workspace" createInitialData={createInitialData} />;
}
