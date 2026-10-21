import { CalendarClock, Plus, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Temporary style preview for Step 1.2 — replaced by the real board in Step 1.4.

const labels = [
  ["mint", "bg-label-mint text-label-mint-foreground"],
  ["sky", "bg-label-sky text-label-sky-foreground"],
  ["lilac", "bg-label-lilac text-label-lilac-foreground"],
  ["peach", "bg-label-peach text-label-peach-foreground"],
  ["lemon", "bg-label-lemon text-label-lemon-foreground"],
  ["rose", "bg-label-rose text-label-rose-foreground"],
  ["sage", "bg-label-sage text-label-sage-foreground"],
  ["slate", "bg-label-slate text-label-slate-foreground"],
] as const;

function StylePanel({ dark }: { dark?: boolean }) {
  return (
    <section
      className={cn(
        "bg-background text-foreground space-y-5 rounded-2xl border p-5",
        dark && "dark",
      )}
    >
      <h2 className="text-lg font-semibold">{dark ? "Dark" : "Light"}</h2>

      <div className="flex flex-wrap gap-2">
        <Button>
          <Plus /> New card
        </Button>
        <Button variant="ai">
          <Sparkles /> Chunk it
        </Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {labels.map(([name, cls]) => (
          <span key={name} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>
            {name}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs font-medium">
        <span className="bg-due-overdue-soft text-due-overdue rounded-full px-2.5 py-0.5">
          Overdue
        </span>
        <span className="bg-due-today-soft text-due-today rounded-full px-2.5 py-0.5">Today</span>
        <span className="bg-due-soon-soft text-due-soon rounded-full px-2.5 py-0.5">In 2 days</span>
      </div>

      <div className="bg-column rounded-xl p-3">
        <p className="mb-3 px-1 text-sm font-semibold">
          To Do <span className="text-muted-foreground">2</span>
        </p>
        <div className="space-y-2">
          <article className="border-l-due-today bg-card text-card-foreground shadow-soft rounded-lg border-l-4 p-3">
            <div className="mb-2 flex gap-1.5">
              <span className="bg-label-lilac text-label-lilac-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                design
              </span>
            </div>
            <p className="font-medium">Launch portfolio website</p>
            <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-3/5 rounded-full" />
            </div>
            <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
              <span>3/5 subtasks</span>
              <span className="text-due-today inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" /> Today
              </span>
            </div>
          </article>
          <article className="bg-card text-card-foreground shadow-lift rounded-lg p-3">
            <p className="font-medium">Write the README</p>
            <p className="text-muted-foreground mt-1 text-sm">Lifted card (while dragging)</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Big tasks, <span className="text-ai">bite-sized.</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            A kanban board with an AI that chunks overwhelming tasks into small, doable steps.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <StylePanel />
          <StylePanel dark />
        </div>
      </main>
    </>
  );
}
