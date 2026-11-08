"use client";

import { useSyncExternalStore } from "react";
import { browserStorage } from "@/lib/storage/local-storage-adapter";
import {
  DARK_QUERY,
  isThemePreference,
  resolveTheme,
  THEME_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

// The theme lives on <html class="dark">, set first by THEME_SCRIPT and then kept in sync
// here: on a choice in this tab, a choice in another tab, or the device switching modes.

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = browserStorage()?.getItem(THEME_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

const systemDark = () => window.matchMedia(DARK_QUERY).matches;

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  // Switch instantly instead of every color fading at its own speed.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}

function sync() {
  applyTheme(resolveTheme(readPreference(), systemDark()));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.matchMedia(DARK_QUERY).addEventListener("change", sync);
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.matchMedia(DARK_QUERY).removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(event: StorageEvent) {
  if (event.key === THEME_KEY) sync();
}

export function setThemePreference(preference: ThemePreference) {
  try {
    browserStorage()?.setItem(THEME_KEY, preference);
  } catch {
    // Blocked storage: the choice still applies until the page reloads.
  }
  applyTheme(resolveTheme(preference, systemDark()));
  for (const listener of listeners) listener();
}

// One string snapshot ("dark:system") so React compares a stable value.
const getSnapshot = () => {
  const preference = readPreference();
  return `${resolveTheme(preference, systemDark())}:${preference}`;
};
// The server can't know the theme; the toggle shows a neutral state until hydrated.
const getServerSnapshot = () => "light:system";

export function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme } {
  const [resolved, preference] = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  ).split(":") as [ResolvedTheme, ThemePreference];
  return { preference, resolved };
}
