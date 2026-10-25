"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BoardWorkspace } from "@/components/board/board-workspace";
import { Button } from "@/components/ui/button";
import { createDemoState } from "@/lib/storage/demo-seed";
import { useBoardActions } from "@/store/board-store-provider";

const createInitialData = () => createDemoState(new Date());

/** The demo board, saved in this browser under its own key (never mixed with real boards). */
export function DemoBoard() {
  return (
    <BoardWorkspace
      namespace="demo"
      createInitialData={createInitialData}
      toolbar={<ResetDemoButton />}
    />
  );
}

function ResetDemoButton() {
  const { replaceState } = useBoardActions();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        replaceState(createDemoState(new Date()));
        toast("Demo board reset");
      }}
    >
      <RotateCcw /> Reset demo
    </Button>
  );
}
