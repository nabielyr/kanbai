"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

const PIECES = 14;
const DURATION_MS = 900;
const COLORS = [
  "bg-primary",
  "bg-ai",
  "bg-label-mint-foreground",
  "bg-label-lemon-foreground",
  "bg-label-sky-foreground",
  "bg-label-rose-foreground",
];

// Fixed scatter, so every burst looks a little different per piece but renders the same
// on every pass (no Math.random during render).
const pieces = Array.from({ length: PIECES }, (_, i) => {
  // Fan out over the upper half, from about 200° to 340°.
  const angle = ((200 + (140 * i) / (PIECES - 1)) * Math.PI) / 180;
  const distance = 46 + ((i * 37) % 5) * 9;
  return {
    x: Math.round(Math.cos(angle) * distance * 1.4),
    y: Math.round(Math.sin(angle) * distance),
    spin: (i % 2 === 0 ? 1 : -1) * (180 + ((i * 53) % 4) * 90),
    color: COLORS[i % COLORS.length],
    shape: i % 3 === 0 ? "h-1.5 w-1.5 rounded-full" : "h-2.5 w-1 rounded-[1px]",
    delay: (i % 4) * 25,
  };
});

/**
 * A small burst of paper scraps from the middle of its (relatively positioned) parent.
 * Purely decorative; the caller skips it when the device asks for reduced motion.
 */
export function ConfettiBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DURATION_MS + 150);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <span
      aria-hidden="true"
      data-testid="confetti"
      className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-0"
    >
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={cn("animate-confetti absolute", piece.shape, piece.color)}
          style={
            {
              "--confetti-x": `${piece.x}px`,
              "--confetti-y": `${piece.y}px`,
              "--confetti-spin": `${piece.spin}deg`,
              animationDelay: `${piece.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
