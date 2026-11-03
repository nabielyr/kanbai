"use client";

import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { loginPath } from "@/lib/auth/redirect";
import { getUserDisplay } from "@/lib/auth/user-display";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAuthConfigured } from "@/lib/supabase/config";

/** "Log in" for guests, an avatar menu with "Log out" once logged in. Hidden without Supabase. */
export function AccountMenu() {
  const auth = useAuthUser();
  const pathname = usePathname();

  if (!isAuthConfigured()) return null;
  if (auth.status === "signed-in") return <UserMenu user={auth.user} />;
  // The login page is already the place to log in.
  if (pathname === "/login") return null;
  if (auth.status === "loading") {
    return <span aria-hidden="true" className="bg-muted size-8 animate-pulse rounded-full" />;
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={loginPath(pathname)}>
        <LogIn /> Log in
      </Link>
    </Button>
  );
}

function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const display = getUserDisplay(user);

  const logOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Couldn't log out. Please try again.");
      return;
    }
    toast.success("Logged out");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${display.name}`}
          className="bg-ai-soft text-ai focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full text-xs font-bold outline-none focus-visible:ring-[3px]"
        >
          {display.initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold">{display.name}</span>
          {display.email && (
            <span className="text-muted-foreground block truncate text-xs">{display.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
