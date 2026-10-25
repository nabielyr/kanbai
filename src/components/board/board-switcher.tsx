"use client";

import { ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { NewBoardDialog } from "./new-board-dialog";

/** Header dropdown listing every board, with "New board". */
export function BoardSwitcher() {
  const boardOrder = useBoardData((d) => d.boardOrder);
  const boards = useBoardData((d) => d.boards);
  const activeBoardId = useBoardData((d) => d.activeBoardId);
  const { setActiveBoard } = useBoardActions();
  const [creating, setCreating] = useState(false);
  const activeTitle = activeBoardId ? boards[activeBoardId]?.title : undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-56" aria-label="Switch board">
            <LayoutGrid />
            <span className="truncate">{activeTitle ?? "Boards"}</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Boards</DropdownMenuLabel>
          {boardOrder.length > 0 && (
            <DropdownMenuRadioGroup
              value={activeBoardId ?? ""}
              onValueChange={(id) => setActiveBoard(id)}
            >
              {boardOrder.map((id) => (
                <DropdownMenuRadioItem key={id} value={id} className="truncate">
                  {boards[id]?.title}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus /> New board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewBoardDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
