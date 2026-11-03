import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPanel, LoginPanelSkeleton } from "@/components/auth/login-panel";
import { AppHeader } from "@/components/layout/app-header";

export const metadata: Metadata = {
  title: "Log in — KanbAI",
};

export default function LoginPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
        {/* The panel reads ?next= and ?error=, which are only known in the browser. */}
        <Suspense fallback={<LoginPanelSkeleton />}>
          <LoginPanel />
        </Suspense>
      </main>
    </>
  );
}
