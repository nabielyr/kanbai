import type { ChunkError } from "./client";

// What the Chunk it dialog says for each failure, and what it offers next.

export interface ChunkErrorCopy {
  title: string;
  detail: string;
  /** `wait`: retry becomes available after `retryAfterSec`; `none`: retrying won't help. */
  retry: "now" | "wait" | "none";
  retryAfterSec?: number;
  /** Offer to write the steps by hand instead. */
  offerManual: boolean;
}

export function getChunkErrorCopy(error: ChunkError): ChunkErrorCopy {
  switch (error.code) {
    case "RATE_LIMITED":
      return error.retryAfterSec
        ? {
            title: "The AI is busy",
            detail: `Lots of requests right now. Try again in ${error.retryAfterSec}s.`,
            retry: "wait",
            retryAfterSec: error.retryAfterSec,
            offerManual: false,
          }
        : {
            title: "The AI is busy",
            detail: "Lots of requests right now. Try again in a moment.",
            retry: "now",
            offerManual: false,
          };
    case "QUOTA_EXHAUSTED":
      return {
        title: "Daily AI quota reached",
        detail: "It resets tomorrow. You can still add steps by hand.",
        retry: "none",
        offerManual: true,
      };
    case "TIMEOUT":
      return {
        title: "That took too long",
        detail: "The AI didn't answer in time. Please try again.",
        retry: "now",
        offerManual: false,
      };
    case "INVALID_AI_RESPONSE":
      return {
        title: "The AI returned something odd",
        detail: "Try again — a second attempt usually works.",
        retry: "now",
        offerManual: false,
      };
    case "NETWORK":
      return {
        title: "You seem to be offline",
        detail: "Check your connection and try again.",
        retry: "now",
        offerManual: true,
      };
    case "VALIDATION":
      return {
        title: "This card can't be chunked",
        detail: error.message,
        retry: "none",
        offerManual: true,
      };
    case "LOGIN_REQUIRED":
      return {
        title: "Log in to keep chunking",
        detail: "You've used your free tries. Logging in is free.",
        retry: "none",
        offerManual: true,
      };
    case "UNAVAILABLE":
      return {
        title: "The AI is unavailable",
        // The server's message says why (e.g. AI isn't set up yet).
        detail: error.message,
        retry: "now",
        offerManual: true,
      };
  }
}
