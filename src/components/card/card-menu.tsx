"use client";

import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Ellipsis,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CardMenuProps {
  cardId: string;
  cardTitle: string;
  /** The other columns of the board, in order. */
  moveTargets: { id: string; title: string }[];
  onEditTitle: () => void;
  onChunk: () => void;
  onMoveToColumn: (columnId: string) => void;
  /** Left out when the card is already at the top (or bottom) of its column. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}

export function CardMenu({
  cardId,
  cardTitle,
  moveTargets,
  onEditTitle,
  onChunk,
  onMoveToColumn,
  onMoveUp,
  onMoveDown,
  onDelete,
}: CardMenuProps) {
  // After "Edit title", keep focus in the title editor instead of returning it to this menu.
  const editing = useRef(false);
  // After a move the menu's card has re-rendered somewhere else, so focus the card itself.
  const moved = useRef(false);
  const move = (action: () => void) => () => {
    moved.current = true;
    action();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for “${cardTitle}”`}
          // Always visible on touch screens; revealed on hover/focus with a mouse.
          className="text-muted-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/card:opacity-100 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:data-[state=open]:opacity-100"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => {
          if (editing.current) e.preventDefault();
          if (moved.current) {
            e.preventDefault();
            // Wait a frame for the card to land; focusing it also scrolls it into view.
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardId)}"]`)
                ?.focus(),
            );
          }
          editing.current = false;
          moved.current = false;
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            editing.current = true;
            onEditTitle();
          }}
        >
          <Pencil /> Edit title
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChunk}>
          <Sparkles className="text-ai motion-safe:in-data-highlighted:animate-wiggle" /> Chunk it
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="Move card">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {moveTargets.map((column) => (
            <DropdownMenuItem key={column.id} onSelect={move(() => onMoveToColumn(column.id))}>
              <CornerDownRight /> <span className="truncate">{column.title}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem disabled={!onMoveUp} onSelect={onMoveUp && move(onMoveUp)}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!onMoveDown} onSelect={onMoveDown && move(onMoveDown)}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete card
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
