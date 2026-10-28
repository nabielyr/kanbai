"use client";

import { ListFilter, Search, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { labelSwatchClass, priorityIcon, priorityMeta } from "@/components/card/card-styles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  cardMatchesFilters,
  countFilterOptions,
  DUE_FILTERS,
  EMPTY_FILTERS,
  filterBoard,
  hasActiveFilters,
  type CardFilters,
  type DueFilter,
  type FilteredBoard,
} from "@/lib/domain/filters";
import { PRIORITIES } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useBoardData, useBoardStoreApi } from "@/store/board-store-provider";

interface BoardFiltersValue {
  filters: CardFilters;
  setFilters: (update: (filters: CardFilters) => CardFilters) => void;
  clearFilters: () => void;
  /** The filtered board, or null when no filter is active (everything is shown). */
  filtered: FilteredBoard | null;
  /** Whether a card is currently hidden by the filters (reads the latest store state). */
  isCardHidden: (cardId: string) => boolean;
}

const BoardFiltersContext = createContext<BoardFiltersValue | null>(null);

/** Search & filter state for one board. Not persisted: it resets when you switch boards. */
export function BoardFiltersProvider({
  boardId,
  now,
  children,
}: {
  boardId: string;
  now: Date;
  children: React.ReactNode;
}) {
  const storeApi = useBoardStoreApi();
  const data = useBoardData((d) => d);
  const [filters, setFilterState] = useState<CardFilters>(EMPTY_FILTERS);
  const active = hasActiveFilters(filters);

  const filtered = useMemo(
    () => (active ? filterBoard(data, boardId, filters, now) : null),
    [active, data, boardId, filters, now],
  );

  const setFilters = useCallback(
    (update: (filters: CardFilters) => CardFilters) => setFilterState(update),
    [],
  );
  const clearFilters = useCallback(() => setFilterState(EMPTY_FILTERS), []);

  const isCardHidden = useCallback(
    (cardId: string) => {
      if (!active) return false;
      const state = storeApi.getState().data;
      const card = state.cards[cardId];
      if (!card) return false;
      return !cardMatchesFilters(card, filters, {
        labels: state.boards[card.boardId]?.labels ?? [],
        now,
        isDone: Boolean(state.columns[card.columnId]?.isDone),
      });
    },
    [active, filters, now, storeApi],
  );

  const value = useMemo(
    () => ({ filters, setFilters, clearFilters, filtered, isCardHidden }),
    [filters, setFilters, clearFilters, filtered, isCardHidden],
  );
  return <BoardFiltersContext.Provider value={value}>{children}</BoardFiltersContext.Provider>;
}

export function useBoardFilters(): BoardFiltersValue {
  const context = useContext(BoardFiltersContext);
  if (!context) throw new Error("useBoardFilters must be used inside <BoardFiltersProvider>");
  return context;
}

/** The filtered board, or null outside a provider or when nothing is filtered. */
export function useFilteredBoard(): FilteredBoard | null {
  return useContext(BoardFiltersContext)?.filtered ?? null;
}

const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due in the next 2 days",
  later: "Due later",
  none: "No due date",
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Search field, filter menu and the "N of M shown" summary above the board. */
export function FilterBar({ boardId }: { boardId: string }) {
  const { filters, setFilters, clearFilters, filtered } = useBoardFilters();
  const labels = useBoardData((d) => d.boards[boardId]?.labels);
  const optionCount = countFilterOptions(filters);
  // Keep a menu open while ticking several options.
  const keepOpen = (e: Event) => e.preventDefault();

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="search"
      aria-label="Search and filter cards"
    >
      <div className="relative w-full sm:w-64">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search cards"
          placeholder="Search cards…"
          value={filters.query}
          maxLength={100}
          onChange={(e) => {
            const query = e.target.value;
            setFilters((f) => ({ ...f, query }));
          }}
          className="h-8 pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Filter cards (${optionCount} selected)`}>
            <ListFilter /> Filter
            {optionCount > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5">
                {optionCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-60 overflow-y-auto">
          {labels && labels.length > 0 && (
            <>
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={filters.labelIds.includes(label.id)}
                  onSelect={keepOpen}
                  onCheckedChange={() =>
                    setFilters((f) => ({ ...f, labelIds: toggle(f.labelIds, label.id) }))
                  }
                >
                  <span
                    className={cn("size-3 rounded-full border", labelSwatchClass[label.color])}
                    aria-hidden="true"
                  />
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          {PRIORITIES.map((priority) => {
            const Icon = priorityIcon[priority];
            return (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filters.priorities.includes(priority)}
                onSelect={keepOpen}
                onCheckedChange={() =>
                  setFilters((f) => ({ ...f, priorities: toggle(f.priorities, priority) }))
                }
              >
                <Icon className={priorityMeta[priority].className} aria-hidden="true" />
                {priorityMeta[priority].label}
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />

          <DropdownMenuLabel>Due date</DropdownMenuLabel>
          {DUE_FILTERS.map((due) => (
            <DropdownMenuCheckboxItem
              key={due}
              checked={filters.due.includes(due)}
              onSelect={keepOpen}
              onCheckedChange={() => setFilters((f) => ({ ...f, due: toggle(f.due, due) }))}
            >
              {DUE_FILTER_LABELS[due]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {filtered && `${filtered.shown} of ${filtered.total} cards shown`}
      </p>
      {filtered && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}
