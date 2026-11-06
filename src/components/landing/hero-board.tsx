import { Clock3 } from "lucide-react";
import { DoodleArrow, Tape } from "./doodles";

// The hero picture: one overwhelming card, an arrow, and the small steps it turns into.
// Plain markup instead of a screenshot, so it stays sharp and follows the theme.

const STEPS = [
  { title: "Pick 3 papers to cite", minutes: 25, tilt: -1.5 },
  { title: "Outline the chapters", minutes: 40, tilt: 1 },
  { title: "Draft the intro, badly", minutes: 45, tilt: -0.5 },
  { title: "Email my supervisor", minutes: 10, tilt: 1.5 },
];

export function HeroBoard() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-4">
        <div className="relative w-full max-w-64 -rotate-2">
          <Tape tone="overdue" className="-top-2 left-1/2 -translate-x-1/2 rotate-3" />
          <div className="bg-card shadow-paper rounded-md border p-4">
            <p className="text-label-rose-foreground text-[11px] font-semibold tracking-wide uppercase">
              Due Friday
            </p>
            <p className="font-heading mt-1 text-xl leading-tight font-bold">
              Write my thesis proposal
            </p>
            <p className="text-muted-foreground mt-2 text-sm">...where do I even start?</p>
          </div>
        </div>

        <div className="text-ai flex flex-col items-center lg:-mt-8">
          <span className="font-heading text-sm font-bold">Chunk it</span>
          <DoodleArrow className="rotate-90 lg:rotate-0" />
        </div>

        <ol className="w-full max-w-64 space-y-2.5">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="bg-card shadow-paper relative flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              style={{ transform: `rotate(${step.tilt}deg)` }}
            >
              {i === 0 && <Tape tone="soon" className="-top-2 left-6 h-3 w-12 -rotate-2" />}
              <span className="font-medium">{step.title}</span>
              <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {step.minutes} min
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="sr-only">
        A card that says “Write my thesis proposal” is chunked into four small steps, each with a
        time estimate.
      </figcaption>
    </figure>
  );
}
