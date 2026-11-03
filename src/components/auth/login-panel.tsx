"use client";

import { LoaderCircle, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/brand/provider-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { getEmailLinkErrorMessage, getLoginErrorMessage } from "@/lib/auth/login-errors";
import { authCallbackUrl, safeNextPath } from "@/lib/auth/redirect";
import { getUserDisplay } from "@/lib/auth/user-display";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAuthConfigured } from "@/lib/supabase/config";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card shadow-soft w-full max-w-md rounded-3xl border p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Log in to KanbAI</h1>
      <p className="text-muted-foreground mt-2">
        Keep your boards in sync on every device. No password needed.
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function LoginPanelSkeleton() {
  return (
    <Panel>
      <div aria-hidden="true" className="bg-muted h-24 animate-pulse rounded-2xl" />
    </Panel>
  );
}

/** The login page body. Reads `?next=` (where to go afterwards) and `?error=` from the URL. */
export function LoginPanel() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const errorMessage = getLoginErrorMessage(searchParams.get("error"));
  const auth = useAuthUser();

  if (!isAuthConfigured()) {
    return (
      <Panel>
        <p className="bg-muted rounded-2xl p-4 text-sm">
          Login isn&apos;t set up on this copy of KanbAI yet. You can still{" "}
          <Link
            href="/demo"
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            try the demo
          </Link>{" "}
          or{" "}
          <Link
            href="/boards"
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            use your own boards
          </Link>{" "}
          in this browser.
        </p>
      </Panel>
    );
  }

  if (auth.status === "signed-in") {
    const { email, name } = getUserDisplay(auth.user);
    return (
      <Panel>
        <p className="text-sm">
          You&apos;re logged in as <strong>{email ?? name}</strong>.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href={next}>Continue</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <Panel>
      {errorMessage && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive mb-4 rounded-2xl p-3 text-sm font-medium"
        >
          {errorMessage}
        </p>
      )}
      <OAuthButtons next={next} />
      <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" aria-hidden="true" />
        or use your email
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </div>
      <EmailLinkForm next={next} />
    </Panel>
  );
}

const OAUTH_PROVIDERS = [
  { id: "google", name: "Google", Icon: GoogleIcon },
  { id: "github", name: "GitHub", Icon: GitHubIcon },
] as const;

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]["id"];

function OAuthButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coming back with the browser's Back button restores this page from cache, spinner and all.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const start = async (provider: OAuthProvider, name: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setPending(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl(window.location.origin, next) },
    });
    // On success the browser is already on its way to the provider, so the spinner stays.
    if (error) {
      setPending(null);
      setError(`We couldn't open ${name}. Please try again.`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {OAUTH_PROVIDERS.map(({ id, name, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="lg"
          disabled={pending !== null}
          onClick={() => start(id, name)}
        >
          {pending === id ? <LoaderCircle className="animate-spin" /> : <Icon className="size-4" />}
          Continue with {name}
        </Button>
      ))}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

type EmailState =
  | { status: "idle" | "sending" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

function EmailLinkForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<EmailState>({ status: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setState({ status: "error", message: "Enter a valid email address." });
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setState({ status: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authCallbackUrl(window.location.origin, next) },
    });
    setState(
      error
        ? { status: "error", message: getEmailLinkErrorMessage(error) }
        : { status: "sent", email: address },
    );
  };

  if (state.status === "sent") {
    return (
      <div role="status" className="bg-ai-soft rounded-2xl p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <MailCheck className="text-ai size-4" aria-hidden="true" /> Check your inbox
        </p>
        <p className="mt-1">
          We sent a login link to <strong>{state.email}</strong>. Open it in this browser to finish
          logging in.
        </p>
        <Button
          variant="link"
          className="mt-2 h-auto p-0"
          onClick={() => setState({ status: "idle" })}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  const sending = state.status === "sending";
  const error = state.status === "error" ? state.message : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <label htmlFor="login-email" className="text-sm font-semibold">
        Email
      </label>
      <Input
        id="login-email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "login-email-error" : undefined}
        disabled={sending}
      />
      {error && (
        <p id="login-email-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={sending}>
        {sending ? <LoaderCircle className="animate-spin" /> : <Mail />}
        {sending ? "Sending…" : "Email me a login link"}
      </Button>
    </form>
  );
}
