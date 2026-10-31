"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestChunk, type ChunkClientResult, type ChunkError } from "@/lib/ai/client";
import type { ChunkRequestInput, ChunkResponse } from "@/lib/ai/schemas";

export type ChunkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ChunkResponse }
  | { status: "error"; error: ChunkError };

/**
 * Runs "Chunk it" requests. Starting a new request or cancelling aborts the previous one,
 * and leaving the page (unmount) aborts too, so a late answer never lands in a closed dialog.
 */
export function useChunk(fetchImpl?: typeof fetch) {
  const [state, setState] = useState<ChunkState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  /** Resolves with the result, or null when the request was cancelled. */
  const generate = useCallback(
    async (input: ChunkRequestInput): Promise<ChunkClientResult | null> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ status: "loading" });
      try {
        const result = await requestChunk(input, { signal: current.signal, fetchImpl });
        if (current.signal.aborted) return null;
        setState(
          result.ok
            ? { status: "success", data: result.data }
            : { status: "error", error: result.error },
        );
        return result;
      } catch (error) {
        if (current.signal.aborted) return null;
        throw error;
      }
    },
    [fetchImpl],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, generate, cancel };
}
