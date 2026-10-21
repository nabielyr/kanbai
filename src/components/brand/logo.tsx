import { cn } from "@/lib/utils";

/** A rounded card with a bite taken out of its top-right corner. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="kanbai-bite">
          <rect width="32" height="32" fill="white" />
          <circle cx="27" cy="5" r="4.5" fill="black" />
          <circle cx="22.5" cy="2.5" r="3" fill="black" />
          <circle cx="29.5" cy="10" r="3" fill="black" />
        </mask>
      </defs>
      <g mask="url(#kanbai-bite)">
        <rect x="2" y="2" width="28" height="28" rx="8" className="fill-primary" />
        <rect x="7" y="9" width="11" height="3" rx="1.5" className="fill-primary-foreground" />
        <rect x="7" y="15" width="16" height="3" rx="1.5" className="fill-primary-foreground/70" />
        <rect x="7" y="21" width="8" height="3" rx="1.5" className="fill-primary-foreground/45" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-xl font-bold tracking-tight">
        Kanb<span className="text-ai">AI</span>
      </span>
    </span>
  );
}
