"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions } from "@/store/board-store-provider";

/** "+ Add card" at the bottom of a column. Stays open after Enter so several cards can be added. */
export function AddCard({ columnId, columnTitle }: { columnId: string; columnTitle: string }) {
  const [open, setOpen] = useState(false);
  const { addCard } = useBoardActions();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
      >
        <Plus className="size-4" aria-hidden="true" /> Add card
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <InlineTextInput
        aria-label={`New card title in ${columnTitle}`}
        placeholder="What needs doing?"
        keepOpenOnEnter
        onSubmit={(title) => addCard(columnId, title)}
        onCancel={() => setOpen(false)}
        className="shadow-soft bg-card"
      />
      <p className="text-muted-foreground px-1 text-[11px]">Enter to add · Esc to close</p>
    </div>
  );
}
