"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BoardWorkspace } from "@/components/board/board-workspace";
import { Button } from "@/components/ui/button";
import { createDemoState } from "@/lib/storage/demo-seed";
import { useBoardActions, useBoardStoreApi } from "@/store/board-store-provider";

const createInitialData = () => createDemoState(new Date());

/** The demo board, saved in this browser under its own key (never mixed with real boards). */
export function DemoBoard() {
  return (
    <BoardWorkspace
      namespace="demo"
      createInitialData={createInitialData}
      banner={<DemoBanner />}
      toolbar={<ResetDemoButton />}
    />
  );
}

/** Says where demo changes go, and points to a real board. Shown while loading too. */
function DemoBanner() {
  return (
    <div className="bg-label-lemon text-label-lemon-foreground border-b">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <p>
          <span className="font-semibold">You’re playing with the demo.</span> Changes stay in this
          browser, so go wild.
        </p>
        <Link
          href="/boards"
          className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
        >
          Start my own board <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function ResetDemoButton() {
  const { replaceState } = useBoardActions();
  const storeApi = useBoardStoreApi();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const before = storeApi.getState().data;
        replaceState(createDemoState(new Date()));
        toast("Demo board reset", {
          action: { label: "Undo", onClick: () => replaceState(before) },
        });
      }}
    >
      <RotateCcw /> Reset demo
    </Button>
  );
}
