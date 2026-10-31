"use client";

import { Ellipsis, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CardMenuProps {
  cardTitle: string;
  onEditTitle: () => void;
  onChunk: () => void;
  onDelete: () => void;
}

export function CardMenu({ cardTitle, onEditTitle, onChunk, onDelete }: CardMenuProps) {
  // After "Edit title", keep focus in the title editor instead of returning it to this menu.
  const editing = useRef(false);

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
          editing.current = false;
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
          <Sparkles className="text-ai" /> Chunk it
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete card
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
