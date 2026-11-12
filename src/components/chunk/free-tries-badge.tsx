"use client";

import { useChunksLeftToday } from "@/hooks/use-chunks-left";
import { useFreeTries } from "@/hooks/use-free-tries";
import { cn } from "@/lib/utils";

/**
 * "2 free tries left" for guests, "28 chunks left today" for logged-in users. Nothing when
 * login is off or no limit applies.
 */
export function FreeTriesBadge({ className }: { className?: string }) {
  const freeTries = useFreeTries();
  const chunksLeft = useChunksLeftToday();
  const text =
    freeTries !== null
      ? freeTries === 0
        ? "No free tries left"
        : `${freeTries} free ${freeTries === 1 ? "try" : "tries"} left`
      : chunksLeft !== null
        ? chunksLeft === 0
          ? "No chunks left today"
          : `${chunksLeft} ${chunksLeft === 1 ? "chunk" : "chunks"} left today`
        : null;
  if (text === null) return null;
  return (
    <span
      className={cn(
        "border-ai/30 bg-ai-soft text-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {text}
    </span>
  );
}
