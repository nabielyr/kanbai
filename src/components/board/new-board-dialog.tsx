"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBoardActions } from "@/store/board-store-provider";

export function NewBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createBoard } = useBoardActions();
  const [title, setTitle] = useState("");

  function close() {
    setTitle("");
    onOpenChange(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (createBoard(title)) close();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>
              Starts with To Do, In Progress and Done columns. You can change them anytime.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="Board name"
            placeholder="e.g. Thesis, Side project, Moving house"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
