"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";

/** Board title (click to rename) with a menu for renaming or deleting the board. */
export function BoardTitle({ boardId }: { boardId: string }) {
  const board = useBoardData((d) => d.boards[boardId]);
  const cardCount = useBoardData((d) =>
    (d.boards[boardId]?.columnIds ?? []).reduce(
      (sum, id) => sum + (d.columns[id]?.cardIds.length ?? 0),
      0,
    ),
  );
  const { renameBoard, deleteBoard } = useBoardActions();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const skipFocusReturn = useRef(false);
  if (!board) return null;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {renaming ? (
          <InlineTextInput
            aria-label="Board name"
            initialValue={board.title}
            maxLength={80}
            onSubmit={(title) => {
              renameBoard(board.id, title);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
            className="font-heading max-w-xl py-1 text-2xl font-bold sm:text-3xl"
          />
        ) : (
          <h1 className="min-w-0 text-2xl font-bold sm:text-3xl">
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Click to rename"
              className="hover:bg-muted focus-visible:ring-ring/50 -mx-1 max-w-full truncate rounded-lg px-1 text-left outline-none focus-visible:ring-[3px]"
            >
              {board.title}
            </button>
          </h1>
        )}

        {!renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground shrink-0"
                aria-label="Board actions"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
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
                <Pencil /> Rename board
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                <Trash2 /> Delete board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {board.columnIds.length} columns · {cardCount} cards
      </p>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{board.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes its {board.columnIds.length} columns and {cardCount}{" "}
              {cardCount === 1 ? "card" : "cards"}. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteBoard(board.id)}>
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
