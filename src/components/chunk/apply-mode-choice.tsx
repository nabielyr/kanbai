"use client";

import { ListChecks, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";

export type ApplyMode = "checklist" | "cards";

const EMPTY: string[] = [];

/** "Add as checklist on this card" or "Create as new cards in [column]". */
export function ApplyModeChoice({
  boardId,
  mode,
  onModeChange,
  columnId,
  onColumnChange,
}: {
  boardId: string;
  mode: ApplyMode;
  onModeChange: (mode: ApplyMode) => void;
  columnId: string;
  onColumnChange: (columnId: string) => void;
}) {
  const columnIds = useBoardData((d) => d.boards[boardId]?.columnIds ?? EMPTY);
  const columns = useBoardData((d) => d.columns);
  const option = (value: ApplyMode, icon: React.ReactNode, label: React.ReactNode) => (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        "has-focus-visible:ring-ring/50 hover:bg-muted has-focus-visible:ring-[3px]",
        mode === value && "border-primary bg-primary/10",
      )}
    >
      <input
        type="radio"
        name="chunk-apply-mode"
        value={value}
        checked={mode === value}
        onChange={() => onModeChange(value)}
        className="accent-primary"
      />
      {icon}
      {label}
    </label>
  );

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Save the steps</legend>
      {option(
        "checklist",
        <ListChecks className="text-muted-foreground size-4" aria-hidden="true" />,
        "Add as a checklist on this card",
      )}
      {option(
        "cards",
        <SquareStack className="text-muted-foreground size-4" aria-hidden="true" />,
        <span className="flex flex-wrap items-center gap-1.5">
          Create as new cards in
          <select
            aria-label="Column for the new cards"
            value={columnId}
            onChange={(e) => {
              onColumnChange(e.target.value);
              onModeChange("cards");
            }}
            className="border-input bg-background focus-visible:ring-ring/50 rounded-md border px-1.5 py-0.5 text-sm outline-none focus-visible:ring-[3px]"
          >
            {columnIds.map((id) =>
              columns[id] ? (
                <option key={id} value={id}>
                  {columns[id].title}
                </option>
              ) : null,
            )}
          </select>
        </span>,
      )}
    </fieldset>
  );
}
