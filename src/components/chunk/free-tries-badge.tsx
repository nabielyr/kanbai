"use client";

import { useFreeTries } from "@/hooks/use-free-tries";
import { cn } from "@/lib/utils";

/** "2 free tries left" for guests; nothing for logged-in users or when login is off. */
export function FreeTriesBadge({ className }: { className?: string }) {
  const left = useFreeTries();
  if (left === null) return null;
  return (
    <span
      className={cn(
        "border-ai/30 bg-ai-soft text-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {left === 0 ? "No free tries left" : `${left} free ${left === 1 ? "try" : "tries"} left`}
    </span>
  );
}
