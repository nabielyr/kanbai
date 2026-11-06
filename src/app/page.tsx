import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/brand/provider-icons";
import { Squiggle, Tape, type TapeTone } from "@/components/landing/doodles";
import { HeroBoard } from "@/components/landing/hero-board";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";

const STEPS: { title: string; body: string; tilt: number; tape: TapeTone }[] = [
  {
    title: "Dump the big task",
    body: "Write it the way it sits in your head. Messy is fine.",
    tilt: -1.5,
    tape: "overdue",
  },
  {
    title: "Hit “Chunk it”",
    body: "The AI suggests 3 to 8 small steps with time estimates. Edit, reorder or toss any of them.",
    tilt: 1,
    tape: "today",
  },
  {
    title: "Do the next one",
    body: "Steps land as a checklist or as new cards. Drag them to Done and watch the bar fill up.",
    tilt: -0.5,
    tape: "soon",
  },
];

const FEATURES = [
  "Drag cards and columns around with a mouse, a finger or the keyboard",
  "Labels, priorities, due dates and checklists on every card",
  "“What should I do next?” picks a card for you",
  "Search and filter without losing your place",
  "Works without an account; boards stay in your browser",
  "Log in to keep your boards in sync on every device",
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="min-w-0">
            <h1 className="text-[2.75rem] leading-[1.02] font-extrabold sm:text-6xl lg:text-7xl">
              Big tasks, <br />
              <span className="relative inline-block whitespace-nowrap">
                bite-sized.
                <Squiggle className="text-primary absolute -bottom-2 left-0" />
              </span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-lg text-lg">
              A kanban board for the tasks you keep putting off. Drop one in, let the AI break it
              into steps small enough to start right now, then move them along.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/demo">
                  Try the demo board <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/boards">Start my own board</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">Free. No account needed to start.</p>
          </div>
          <HeroBoard />
        </section>

        <section className="bg-column border-y py-16" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="how-heading" className="text-3xl font-bold sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="bg-card shadow-paper relative rounded-md border p-5 pt-6"
                  style={{ transform: `rotate(${step.tilt}deg)` }}
                >
                  <Tape tone={step.tape} className="-top-2 left-1/2 -translate-x-1/2 -rotate-2" />
                  <span className="font-heading text-primary text-4xl font-extrabold">{i + 1}</span>
                  <h3 className="mt-2 text-xl font-bold">{step.title}</h3>
                  <p className="text-muted-foreground mt-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Also on the board</h2>
            <ul className="mt-8 space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="bg-label-mint text-label-mint-foreground mt-0.5 grid size-5 shrink-0 place-items-center rounded">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <aside className="bg-label-lemon shadow-paper relative self-start rounded-md p-6 lg:mt-14 lg:rotate-1">
            <Tape tone="today" className="-top-2 left-8 -rotate-3" />
            <h2 className="font-heading text-xl font-bold">The fine print</h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm">
              <li>
                Guests get 3 free AI chunks. Logging in with Google, GitHub or email is free and
                unlocks more.
              </li>
              <li>
                Your task text is sent to an AI service to chunk it, so keep secrets out of it.
              </li>
              <li>Boards made without an account live only in this browser.</li>
            </ul>
          </aside>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Made by Nabiel Yandra.</p>
          <a
            href="https://github.com/nabielyr/kanbai"
            className="hover:text-foreground inline-flex items-center gap-2 underline-offset-4 hover:underline"
          >
            <GitHubIcon className="size-4" /> Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
