import { cn } from "@/lib/utils";

// Hand-drawn marks for the landing page. Decorative only, so screen readers skip them.

/** A loose marker underline. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 18"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
      className={cn("h-3 w-full", className)}
    >
      <path
        d="M3 12c22-7 41-8 60-4s30 6 52 1 38-9 58-6 29 5 44 2"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A curvy arrow, like one drawn with a pen. Points right. */
export function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 60" fill="none" aria-hidden="true" className={cn("h-12 w-20", className)}>
      <path
        d="M4 40c14-22 38-32 62-22 6 3 10 7 13 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M66 30l14 3 2-14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TAPE_TONES = {
  today: "bg-tape-today",
  soon: "bg-tape-soon",
  overdue: "bg-tape-overdue",
} as const;

export type TapeTone = keyof typeof TAPE_TONES;

/** A strip of washi tape, positioned by the caller. */
export function Tape({ tone = "today", className }: { tone?: TapeTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("washi-tape absolute h-4 w-16", TAPE_TONES[tone], className)}
    />
  );
}
