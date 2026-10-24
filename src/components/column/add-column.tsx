"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions } from "@/store/board-store-provider";

/** "+ Add column" placeholder at the end of the board. */
export function AddColumn({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const { addColumn } = useBoardActions();

  return (
    <div className="w-[85vw] shrink-0 snap-center sm:w-72">
      {open ? (
        <div className="bg-column space-y-1.5 rounded-xl p-3">
          <InlineTextInput
            aria-label="New column name"
            placeholder="Column name"
            maxLength={60}
            keepOpenOnEnter
            onSubmit={(title) => addColumn(boardId, title)}
            onCancel={() => setOpen(false)}
            className="bg-card"
          />
          <p className="text-muted-foreground px-1 text-[11px]">Enter to add · Esc to close</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:bg-column hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
        >
          <Plus className="size-4" aria-hidden="true" /> Add column
        </button>
      )}
    </div>
  );
}
