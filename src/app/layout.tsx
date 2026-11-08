import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { THEME_SCRIPT } from "@/lib/theme";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "KanbAI | Big tasks, bite-sized.",
  description: "A kanban board with an AI that breaks big tasks into small, actionable subtasks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script adds "dark" to <html> before React loads, so its class differs on purpose.
    <html
      lang="en"
      className={cn("h-full antialiased", inter.variable, bricolage.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
