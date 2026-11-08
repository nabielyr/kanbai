// Light, dark, or whatever the device prefers. The choice is kept per browser.

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "kanbai:v1:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/**
 * Runs in <head> before the page paints, so a dark-mode visitor never sees a white flash.
 * Kept tiny and dependency-free on purpose; it mirrors resolveTheme() below.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}
