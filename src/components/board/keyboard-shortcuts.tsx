"use client";

import { Keyboard } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCardDialog } from "@/components/card/card-dialog-context";
import { useChunkDialog } from "@/components/chunk/chunk-dialog-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setThemePreference, useTheme } from "@/hooks/use-theme";

// Single-key shortcuts for the board. They stay quiet while you type, while a menu is open,
// and when combined with Ctrl, Cmd or Alt, so they never clash with the browser or a field.

interface ShortcutsContextValue {
  /** An "Add card" composer offers to be opened by N. Returns the unregister function. */
  registerComposer: (columnId: string, open: () => void) => () => void;
  /** Remembers the column under the pointer, so N adds the card where you are looking. */
  setHoveredColumn: (columnId: string | null) => void;
  openHelp: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["N"], action: "New card in the column under the pointer, or the first one" },
  { keys: ["/"], action: "Search cards" },
  { keys: ["C"], action: "Chunk the open or focused card with AI" },
  { keys: ["T"], action: "Switch between light and dark" },
  { keys: ["?"], action: "Show these shortcuts" },
  { keys: ["Enter"], action: "Open the focused card" },
  { keys: ["Space", "←", "→", "↑", "↓"], action: "Pick up a focused card and move it" },
  { keys: ["Esc"], action: "Close a dialog, menu or editor" },
];

const TYPING = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

function isTyping(target: EventTarget | null) {
  return target instanceof Element && target.closest(TYPING) !== null;
}

function openDialogCount() {
  return document.querySelectorAll("[role='dialog'], [role='alertdialog']").length;
}

export function KeyboardShortcutsProvider({
  boardColumnIds,
  children,
}: {
  boardColumnIds: string[];
  children: React.ReactNode;
}) {
  const { openCardId } = useCardDialog();
  const { openChunk } = useChunkDialog();
  const { resolved } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const composers = useRef(new Map<string, () => void>());
  const hoveredColumn = useRef<string | null>(null);

  const registerComposer = useCallback((columnId: string, open: () => void) => {
    composers.current.set(columnId, open);
    return () => {
      if (composers.current.get(columnId) === open) composers.current.delete(columnId);
    };
  }, []);
  const setHoveredColumn = useCallback((columnId: string | null) => {
    hoveredColumn.current = columnId;
  }, []);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (event.target instanceof Element && event.target.closest("[role='menu']")) return;

      const key = event.key.toLowerCase();
      const dialogs = openDialogCount();
      // Inside the card dialog only C makes sense; any other dialog keeps its keys to itself.
      const inCardDialog = openCardId !== null && dialogs === 1;
      if (dialogs > 0 && !(inCardDialog && key === "c")) return;

      const focusedCard = (event.target as Element | null)
        ?.closest?.("[data-card-id]")
        ?.getAttribute("data-card-id");
      const focusedColumn = (event.target as Element | null)
        ?.closest?.("[data-column-id]")
        ?.getAttribute("data-column-id");

      if (key === "n") {
        const columnId = [focusedColumn, hoveredColumn.current, boardColumnIds[0]].find(
          (id) => id && composers.current.has(id),
        );
        if (!columnId) return;
        event.preventDefault();
        composers.current.get(columnId)?.();
      } else if (key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-board-search]");
        if (!search) return;
        event.preventDefault();
        search.focus();
        search.select();
      } else if (key === "c") {
        const cardId = inCardDialog ? openCardId : focusedCard;
        if (!cardId) return;
        event.preventDefault();
        openChunk(cardId);
      } else if (key === "t") {
        event.preventDefault();
        setThemePreference(resolved === "dark" ? "light" : "dark");
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openCardId, openChunk, resolved, boardColumnIds]);

  const value = useMemo(
    () => ({ registerComposer, setHoveredColumn, openHelp }),
    [registerComposer, setHoveredColumn, openHelp],
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </ShortcutsContext.Provider>
  );
}

function useShortcuts(): ShortcutsContextValue | null {
  return useContext(ShortcutsContext);
}

/** Lets N open this column's composer. A no-op outside the board (e.g. in a lone test). */
export function useRegisterComposer(columnId: string, open: () => void) {
  const shortcuts = useShortcuts();
  useEffect(() => shortcuts?.registerComposer(columnId, open), [shortcuts, columnId, open]);
}

export function useHoveredColumn(columnId: string) {
  const shortcuts = useShortcuts();
  return useMemo(
    () => ({
      onPointerEnter: () => shortcuts?.setHoveredColumn(columnId),
      onPointerLeave: () => shortcuts?.setHoveredColumn(null),
    }),
    [shortcuts, columnId],
  );
}

/** A small keyboard button beside the board tools; hidden on touch-only screens. */
export function ShortcutsButton() {
  const shortcuts = useShortcuts();
  if (!shortcuts) return null;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"
      onClick={shortcuts.openHelp}
      className="text-muted-foreground hidden [@media(hover:hover)]:inline-flex"
    >
      <Keyboard />
    </Button>
  );
}

function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            They work anywhere on the board, except while you&rsquo;re typing.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-border divide-y">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="grid grid-cols-[11rem_1fr] items-center gap-3 py-2">
              <dt className="flex flex-wrap gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="bg-card text-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 px-1.5 font-mono text-xs font-medium"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{action}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
