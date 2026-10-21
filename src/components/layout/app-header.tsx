import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="focus-visible:ring-ring/50 rounded-lg focus-visible:ring-[3px]">
          <Logo />
        </Link>
        <p className="text-muted-foreground hidden text-sm md:block">Big tasks, bite-sized.</p>
        {/* Board switcher, theme toggle and account menu land here in later steps. */}
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
