"use client";

import { cn } from "cn";
import { CloudAlert, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import { useSyncStatus, type SyncStatus } from "@/store/persisted-board-provider";

const COPY: Record<SyncStatus, { label: string; hint: string; Icon: typeof CloudCheck }> = {
  saved: { label: "Saved", hint: "Your boards are saved to your account.", Icon: CloudCheck },
  saving: { label: "Saving…", hint: "Saving your changes to your account.", Icon: LoaderCircle },
  offline: {
    label: "Offline",
    hint: "Changes are kept here and will save when you’re back online.",
    Icon: CloudOff,
  },
  error: { label: "Not saved", hint: "Couldn’t save your changes. Retrying…", Icon: CloudAlert },
};

/** "Saving… / Saved / Offline" for boards saved to the account; nothing for guests. */
export function SyncStatusIndicator() {
  const status = useSyncStatus();
  if (!status) return null;
  const { label, hint, Icon } = COPY[status];
  return (
    <p
      role="status"
      title={hint}
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 text-sm",
        status === "error" && "text-destructive",
      )}
    >
      <Icon className={cn("size-4", status === "saving" && "animate-spin")} aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </p>
  );
}
