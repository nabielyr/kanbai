import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring/50 shrink-0 rounded-lg focus-visible:ring-[3px]"
        >
          <Logo />
        </Link>
        <p className="text-muted-foreground hidden text-sm md:block">Big tasks, bite-sized.</p>
        {/* min-w-0 lets the board switcher shrink on phones instead of pushing past the edge. */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {children}
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
