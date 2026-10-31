"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChunk } from "@/hooks/use-chunk";
import {
  DETAIL_LEVELS,
  DETAIL_TARGETS,
  MAX_CHUNK_DESCRIPTION,
  type DetailLevel,
} from "@/lib/ai/schemas";
import { draftFromSubtasks, type DraftSubtask } from "@/lib/ai/subtask-draft";
import { createId } from "@/lib/domain/ids";
import { cn } from "@/lib/utils";
import { useBoardData } from "@/store/board-store-provider";
import { SubtaskPreviewList } from "./subtask-preview-list";

const DETAIL_LABELS: Record<DetailLevel, string> = {
  brief: "Brief",
  medium: "Medium",
  detailed: "Detailed",
};

const PROVIDER_NAMES = { gemini: "Gemini", groq: "Groq" } as const;

export function ChunkDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  // Keep showing the last card while the close animation runs.
  const [shownCardId, setShownCardId] = useState(cardId);
  if (cardId && cardId !== shownCardId) setShownCardId(cardId);
  const exists = useBoardData((d) => (shownCardId ? Boolean(d.cards[shownCardId]) : false));

  return (
    <Dialog open={cardId !== null && exists} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {shownCardId && exists && <ChunkDialogBody key={shownCardId} cardId={shownCardId} />}
      </DialogContent>
    </Dialog>
  );
}

function ChunkDialogBody({ cardId }: { cardId: string }) {
  const card = useBoardData((d) => d.cards[cardId]);
  const [detail, setDetail] = useState<DetailLevel>("medium");
  const [draft, setDraft] = useState<DraftSubtask[] | null>(null);
  const { state, generate, cancel } = useChunk();
  const loading = state.status === "loading";

  if (!card) return null;

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

      {state.status === "error" && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <span>{state.error.message}</span>
          <Button variant="outline" size="xs" onClick={run}>
            <RefreshCw /> Try again
          </Button>
        </div>
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
          </section>
        )
      )}

      <p className="text-muted-foreground text-xs">
        Your task text is sent to an AI service. Don&apos;t put sensitive info in tasks you chunk.
      </p>

      <DialogFooter>
        {loading ? (
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : draft ? (
          <Button variant="outline" onClick={run}>
            <RefreshCw /> Regenerate
          </Button>
        ) : (
          <Button variant="ai" onClick={run}>
            <Sparkles /> Generate steps
          </Button>
        )}
      </DialogFooter>
    </>
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
