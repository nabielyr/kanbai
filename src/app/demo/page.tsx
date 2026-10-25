import type { Metadata } from "next";
import { DemoBoard } from "./demo-board";

export const metadata: Metadata = {
  title: "Demo board — KanbAI",
};

export default function DemoPage() {
  return <DemoBoard />;
}
