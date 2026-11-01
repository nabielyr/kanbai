"use client";

import { PencilLine, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChunkError } from "@/lib/ai/client";
import { getChunkErrorCopy } from "@/lib/ai/error-copy";

/**
 * A friendly explanation of why chunking failed, with what to do next: retry (after a
 * countdown when the AI asked us to wait) and/or write the steps by hand.
 * Mounted fresh for each failure, so the countdown starts from the server's delay.
 */
export function ChunkErrorNotice({
  error,
  onRetry,
  onManual,
}: {
  error: ChunkError;
  onRetry: () => void;
  /** Omitted when steps are already being edited by hand. */
  onManual?: () => void;
}) {
  const copy = getChunkErrorCopy(error);
  const [secondsLeft, setSecondsLeft] = useState(
    copy.retry === "wait" ? (copy.retryAfterSec ?? 0) : 0,
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 space-y-2 rounded-lg border px-3 py-2.5 text-sm"
    >
      <p className="font-semibold">{copy.title}</p>
      <p className="text-muted-foreground">{copy.detail}</p>
      {(copy.retry !== "none" || (copy.offerManual && onManual)) && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {copy.retry !== "none" && (
            <Button variant="outline" size="xs" onClick={onRetry} disabled={secondsLeft > 0}>
              <RefreshCw /> {secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Try again"}
            </Button>
          )}
          {copy.offerManual && onManual && (
            <Button variant="ghost" size="xs" onClick={onManual}>
              <PencilLine /> Add steps by hand
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
