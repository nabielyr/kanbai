import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";

// Minimal landing page; the full landing (features, screenshots) comes in Step 6.1.
export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <span className="bg-ai-soft text-ai mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <Sparkles className="size-3.5" aria-hidden="true" /> AI-powered task chunking
        </span>
        <h1 className="text-4xl font-extrabold sm:text-6xl">
          Big tasks, <span className="text-ai">bite-sized.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-lg">
          A kanban board with an AI that chunks overwhelming tasks into small, doable steps.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/demo">
              Try the demo <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/boards">Start my own board</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
