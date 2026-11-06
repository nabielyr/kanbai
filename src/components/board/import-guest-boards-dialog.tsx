"use client";

import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { remapPendingChunk } from "@/lib/ai/pending-chunk";
import { createEmptyState } from "@/lib/domain/board-ops";
import { createId } from "@/lib/domain/ids";
import { mergeBoards } from "@/lib/domain/merge-boards";
import {
  clearGuestBoards,
  findGuestBoardsToImport,
  markGuestBoardsHandled,
} from "@/lib/storage/guest-import";
import { isUntouchedWorkspace } from "@/lib/storage/workspace-seed";
import { useBoardStoreApi } from "@/store/board-store-provider";
import { useSaveNow } from "@/store/persisted-board-provider";

const MAX_LISTED = 5;

const boardsLabel = (count: number) => (count === 1 ? "1 board" : `${count} boards`);

/**
 * After login: offers the boards made as a guest in this browser to the account.
 * Import copies them in (replacing an untouched starter board) and, once they're saved,
 * removes the guest copy. Skip keeps them in this browser only and doesn't ask again.
 * Closing the dialog without choosing asks again next time.
 */
export function ImportGuestBoardsDialog({ userId }: { userId: string }) {
  // Rendered only after the account's boards loaded in the browser, so storage is readable.
  const [offer, setOffer] = useState(() => findGuestBoardsToImport(userId));
  const [importing, setImporting] = useState(false);
  const storeApi = useBoardStoreApi();
  const saveNow = useSaveNow();

  if (!offer) return null;
  const count = offer.titles.length;
  const listed = offer.titles.slice(0, MAX_LISTED);

  async function handleImport() {
    if (!offer) return;
    setImporting(true);
    const current = storeApi.getState().data;
    const base = isUntouchedWorkspace(current) ? createEmptyState() : current;
    const { state, cardIds } = mergeBoards(base, offer.data, createId);
    // A chunk asked for before logging in now runs on the imported copy of its card.
    remapPendingChunk(cardIds);
    storeApi.getState().actions.replaceState(state);
    markGuestBoardsHandled(userId, offer.fingerprint);

    const saved = await saveNow();
    if (saved) {
      clearGuestBoards();
      toast.success(`Imported ${boardsLabel(count)} to your account.`);
    } else {
      toast(`Imported ${boardsLabel(count)}.`, {
        description:
          "They’ll be saved to your account once you’re back online. The guest copy stays in this browser until then.",
      });
    }
    setOffer(null);
  }

  function handleSkip() {
    if (!offer) return;
    markGuestBoardsHandled(userId, offer.fingerprint);
    setOffer(null);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !importing) setOffer(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? "Import your guest board?" : `Import your ${count} guest boards?`}
          </DialogTitle>
          <DialogDescription>
            You made {count === 1 ? "this board" : "these boards"} in this browser before logging
            in. Import {count === 1 ? "it" : "them"} to keep {count === 1 ? "it" : "them"} in your
            account and on every device.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5" aria-label="Guest boards">
          {listed.map((title, i) => (
            <li key={i} className="bg-muted flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <LayoutGrid className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{title}</span>
            </li>
          ))}
          {count > listed.length && (
            <li className="text-muted-foreground px-3 text-sm">and {count - listed.length} more</li>
          )}
        </ul>
        <p className="text-muted-foreground text-sm">
          Skip keeps {count === 1 ? "it" : "them"} in this browser only.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={importing}>
            Skip
          </Button>
          <Button onClick={() => void handleImport()} disabled={importing}>
            {importing ? "Importing…" : `Import ${boardsLabel(count)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
