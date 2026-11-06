"use client";

import { Check, LogIn, PencilLine, RefreshCw, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChunk } from "@/hooks/use-chunk";
import type { ChunkError } from "@/lib/ai/client";
import { savePendingChunk } from "@/lib/ai/pending-chunk";
import {
  DETAIL_LEVELS,
  DETAIL_TARGETS,
  MAX_CHUNK_DESCRIPTION,
  type DetailLevel,
} from "@/lib/ai/schemas";
import { draftFromSubtasks, type DraftSubtask } from "@/lib/ai/subtask-draft";
import { loginPath } from "@/lib/auth/redirect";
import { createId } from "@/lib/domain/ids";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoardData } from "@/store/board-store-provider";
import { ApplyModeChoice, type ApplyMode } from "./apply-mode-choice";
import type { OpenChunkOptions } from "./chunk-dialog-context";
import { ChunkErrorNotice } from "./chunk-error-notice";
import { FreeTriesBadge } from "./free-tries-badge";
import { SubtaskPreviewList } from "./subtask-preview-list";

const DETAIL_LABELS: Record<DetailLevel, string> = {
  brief: "Brief",
  medium: "Medium",
  detailed: "Detailed",
};

const PROVIDER_NAMES = { gemini: "Gemini", groq: "Groq" } as const;

export function ChunkDialog({
  cardId,
  options,
  onClose,
}: {
  cardId: string | null;
  options?: OpenChunkOptions;
  onClose: () => void;
}) {
  // Keep showing the last card while the close animation runs.
  const [shownCardId, setShownCardId] = useState(cardId);
  if (cardId && cardId !== shownCardId) setShownCardId(cardId);
  const exists = useBoardData((d) => (shownCardId ? Boolean(d.cards[shownCardId]) : false));

  return (
    <Dialog open={cardId !== null && exists} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {shownCardId && exists && (
          <ChunkDialogBody
            key={shownCardId}
            cardId={shownCardId}
            options={options}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChunkDialogBody({
  cardId,
  options = {},
  onClose,
}: {
  cardId: string;
  options?: OpenChunkOptions;
  onClose: () => void;
}) {
  const card = useBoardData((d) => d.cards[cardId]);
  const firstColumnId = useBoardData((d) =>
    card ? d.boards[card.boardId]?.columnIds[0] : undefined,
  );
  const columns = useBoardData((d) => d.columns);
  const { applyChunkAsChecklist, applyChunkAsCards } = useBoardActions();
  const [detail, setDetail] = useState<DetailLevel>(options.detail ?? "medium");
  const [draft, setDraft] = useState<DraftSubtask[] | null>(null);
  const [mode, setMode] = useState<ApplyMode>("checklist");
  // New cards go to the board's first column unless another one is picked.
  const [chosenColumnId, setChosenColumnId] = useState<string | null>(null);
  const { state, generate, cancel } = useChunk();
  const loading = state.status === "loading";
  const pathname = usePathname();

  // Resuming after login: generate right away, as if Generate had been clicked.
  const runOnOpen = useEffectEvent(() => {
    if (options.autoRun) void run();
  });
  useEffect(() => runOnOpen(), []);

  if (!card) return null;
  const columnId =
    chosenColumnId && columns[chosenColumnId]?.boardId === card.boardId
      ? chosenColumnId
      : (firstColumnId ?? "");

  function accept() {
    if (!draft || draft.length === 0) return;
    const steps = draft.map(({ title, estimateMinutes }) => ({ title, estimateMinutes }));
    if (mode === "checklist") {
      const added = applyChunkAsChecklist(cardId, steps);
      if (added === 0) {
        toast.error("The checklist is full, so no steps were added.");
        return;
      }
      toast.success(`Added ${added} ${added === 1 ? "step" : "steps"} to the checklist.`);
    } else {
      const created = applyChunkAsCards(cardId, columnId, steps);
      if (created.length === 0) {
        toast.error("Couldn't create the cards. Pick another column and try again.");
        return;
      }
      const where = columns[columnId]?.title ?? "the board";
      toast.success(
        `Created ${created.length} ${created.length === 1 ? "card" : "cards"} in ${where}.`,
      );
    }
    onClose();
  }

  async function run() {
    const result = await generate({
      title: card!.title,
      description: card!.description.slice(0, MAX_CHUNK_DESCRIPTION),
      detail,
    });
    if (result?.ok) setDraft(draftFromSubtasks(result.data.subtasks, createId));
  }

  return (
    <>
      <div className="space-y-1 pr-8">
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="text-ai size-5" aria-hidden="true" /> Chunk it
        </DialogTitle>
        <DialogDescription>
          Break “<span className="text-foreground font-medium">{card.title}</span>” into small,
          doable steps. Nothing is saved until you accept.
        </DialogDescription>
      </div>

      <fieldset className="space-y-2" disabled={loading}>
        <legend className="text-sm font-semibold">Detail level</legend>
        <div className="grid grid-cols-3 gap-2">
          {DETAIL_LEVELS.map((level) => (
            <label key={level} className="relative">
              <input
                type="radio"
                name="chunk-detail"
                value={level}
                checked={detail === level}
                onChange={() => setDetail(level)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors",
                  "hover:bg-muted peer-focus-visible:ring-ring/50 peer-focus-visible:ring-[3px]",
                  "peer-checked:border-ai peer-checked:bg-ai-soft peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                )}
              >
                {DETAIL_LABELS[level]}
                <span className="text-muted-foreground text-xs font-normal">
                  {DETAIL_TARGETS[level].min}–{DETAIL_TARGETS[level].max} steps
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.status === "error" && state.error.code === "LOGIN_REQUIRED" ? (
        <LoginRequiredNotice
          error={state.error}
          loginHref={loginPath(pathname)}
          onLogin={() =>
            savePendingChunk({
              cardId,
              cardTitle: card.title,
              detail,
              path: window.location.pathname,
            })
          }
          onManual={draft ? undefined : () => setDraft([])}
        />
      ) : (
        state.status === "error" && (
          <ChunkErrorNotice
            error={state.error}
            onRetry={run}
            onManual={draft ? undefined : () => setDraft([])}
          />
        )
      )}

      {loading ? (
        <ChunkSkeleton count={DETAIL_TARGETS[detail].min} />
      ) : (
        draft && (
          <section className="space-y-2" aria-label="Preview">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-sans text-sm font-semibold tracking-normal">Suggested steps</h3>
              {state.status === "success" && (
                <span className="text-muted-foreground text-xs">
                  by {PROVIDER_NAMES[state.data.provider]}
                </span>
              )}
            </div>
            <SubtaskPreviewList items={draft} onChange={setDraft} />
            <ApplyModeChoice
              boardId={card.boardId}
              mode={mode}
              onModeChange={setMode}
              columnId={columnId}
              onColumnChange={setChosenColumnId}
            />
          </section>
        )
      )}

      <p className="text-muted-foreground text-xs">
        Your task text is sent to an AI service. Don&apos;t put sensitive info in tasks you chunk.
      </p>

      <DialogFooter className="sm:items-center">
        <FreeTriesBadge className="self-center sm:mr-auto" />
        {loading ? (
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : draft ? (
          <>
            <Button variant="outline" onClick={run}>
              <RefreshCw /> {state.status === "success" ? "Regenerate" : "Generate steps"}
            </Button>
            <Button onClick={accept} disabled={draft.length === 0}>
              <Check /> Accept
            </Button>
          </>
        ) : (
          <Button variant="ai" onClick={run}>
            <Sparkles /> Generate steps
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/** A guest used their free tries: log in (free) and this chunk runs again afterwards. */
function LoginRequiredNotice({
  error,
  loginHref,
  onLogin,
  onManual,
}: {
  error: ChunkError;
  loginHref: string;
  onLogin: () => void;
  onManual?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-ai/30 bg-ai-soft space-y-2 rounded-lg border px-3 py-2.5 text-sm"
    >
      <p className="font-semibold">Log in to keep chunking</p>
      <p className="text-muted-foreground">
        {error.message} We&apos;ll pick up this chunk right after you log in.
      </p>
      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button variant="ai" size="xs" asChild>
          <a href={loginHref} onClick={onLogin}>
            <LogIn /> Log in to continue
          </a>
        </Button>
        {onManual && (
          <Button variant="ghost" size="xs" onClick={onManual}>
            <PencilLine /> Add steps by hand
          </Button>
        )}
      </div>
    </div>
  );
}

/** Placeholder rows while the AI is thinking. */
function ChunkSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="bg-muted size-4 animate-pulse rounded motion-reduce:animate-none" />
          <div
            className="bg-muted h-8 flex-1 animate-pulse rounded-lg motion-reduce:animate-none"
            style={{ animationDelay: `${i * 120}ms` }}
          />
          <div className="bg-muted h-8 w-16 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
      ))}
      <p className="text-muted-foreground text-sm" role="status">
        Thinking up steps…
      </p>
    </div>
  );
}
