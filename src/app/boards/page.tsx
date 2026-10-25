import type { Metadata } from "next";
import { WorkspaceBoard } from "./workspace-board";

export const metadata: Metadata = {
  title: "My boards — KanbAI",
};

export default function BoardsPage() {
  return <WorkspaceBoard />;
}
