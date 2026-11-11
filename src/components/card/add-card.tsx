"use client";

import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useBoardFilters } from "@/components/board/board-filters";
import { useRegisterComposer } from "@/components/board/keyboard-shortcuts";
import { InlineTextInput } from "@/components/common/inline-text-input";
import { useBoardActions } from "@/store/board-store-provider";

/** "+ Add card" at the bottom of a column. Stays open after Enter so several cards can be added. */
export function AddCard({ columnId, columnTitle }: { columnId: string; columnTitle: string }) {
  const [open, setOpen] = useState(false);
  const { addCard } = useBoardActions();
  const { isCardHidden, clearFilters } = useBoardFilters();
  const root = useRef<HTMLDivElement>(null);

  // N opens this composer, or puts the cursor back in it when it is already open.
  const openFromShortcut = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => root.current?.querySelector("input")?.focus());
  }, []);
  useRegisterComposer(columnId, openFromShortcut);

  function add(title: string) {
    const id = addCard(columnId, title);
    if (id && isCardHidden(id)) {
      toast("Card added, but hidden by the current filters.", {
        action: { label: "Clear filters", onClick: clearFilters },
      });
    }
  }

  if (!open) {
    return (
      <div ref={root}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
        >
          <Plus className="size-4" aria-hidden="true" /> Add card
        </button>
      </div>
    );
  }

  return (
    <div ref={root} className="space-y-1.5">
      <InlineTextInput
        aria-label={`New card title in ${columnTitle}`}
        placeholder="What needs doing?"
        keepOpenOnEnter
        onSubmit={add}
        onCancel={() => setOpen(false)}
        className="shadow-soft bg-card"
      />
      <p className="text-muted-foreground px-1 text-[11px]">Enter to add · Esc to close</p>
    </div>
  );
}
