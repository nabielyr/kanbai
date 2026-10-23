import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { DemoBoard } from "./demo-board";

export const metadata: Metadata = {
  title: "Demo board — KanbAI",
};

export default function DemoPage() {
  return (
    <>
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        <DemoBoard />
      </main>
    </>
  );
}
