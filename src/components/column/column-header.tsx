"use client";

import { CircleCheckBig, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { InlineTextInput } from "@/components/common/inline-text-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Column } from "@/lib/domain/types";
import { useBoardActions } from "@/store/board-store-provider";

export function ColumnHeader({ column, headingId }: { column: Column; headingId: string }) {
  const { renameColumn, setColumnDone, deleteColumn } = useBoardActions();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // After "Rename", keep focus in the title editor instead of returning it to the menu.
  const skipFocusReturn = useRef(false);
  const cardCount = column.cardIds.length;

  function requestDelete() {
    if (cardCount === 0) deleteColumn(column.id);
    else setConfirmingDelete(true);
  }

  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-2">
      {column.isDone && (
        <CircleCheckBig
          className="text-label-mint-foreground size-4 shrink-0"
          aria-label="Done column"
        />
      )}

      {renaming ? (
        <InlineTextInput
          aria-label="Column name"
          initialValue={column.title}
          maxLength={60}
          onSubmit={(title) => {
            renameColumn(column.id, title);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
          className="font-heading py-1 text-sm font-semibold"
        />
      ) : (
        <h2 id={headingId} className="font-heading min-w-0 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Click to rename"
            className="hover:bg-background/70 focus-visible:ring-ring/50 max-w-full truncate rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-[3px]"
          >
            {column.title}
          </button>
        </h2>
      )}

      {!renaming && (
        <>
          <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {cardCount}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground ml-auto"
                aria-label={`Actions for column “${column.title}”`}
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => {
                if (skipFocusReturn.current) e.preventDefault();
                skipFocusReturn.current = false;
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  skipFocusReturn.current = true;
                  setRenaming(true);
                }}
              >
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={Boolean(column.isDone)}
                onCheckedChange={(checked) => setColumnDone(column.id, checked === true)}
              >
                Done column
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={requestDelete}>
                <Trash2 /> Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{column.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes its {cardCount} {cardCount === 1 ? "card" : "cards"}. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteColumn(column.id)}>
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
