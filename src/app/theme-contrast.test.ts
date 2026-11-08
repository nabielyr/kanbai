// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every text color must stay readable (WCAG AA, 4.5:1) on the surfaces it sits on, in both
// themes. Reads the tokens straight from globals.css, so a color tweak can't quietly break it.

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function tokens(selector: ":root" | ".dark"): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, name, hex]) => [name, hex]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LABELS = ["mint", "sky", "lilac", "peach", "lemon", "rose", "sage", "slate"];
const DUE = ["overdue", "today", "soon"];
const SURFACES = ["background", "card", "column", "muted"];

/** [text token, background token]: every pair the UI actually uses. */
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["ai-foreground", "ai"],
  ["foreground", "ai-soft"],
  ["foreground", "label-lemon"],
  ...SURFACES.map((s): [string, string] => ["muted-foreground", s]),
  ...LABELS.map((l): [string, string] => [`label-${l}-foreground`, `label-${l}`]),
  // Priority text and the demo banner sit on cards / the page.
  ...["sky", "peach", "rose"].map((l): [string, string] => [`label-${l}-foreground`, "card"]),
  ...DUE.map((d): [string, string] => [`due-${d}`, `due-${d}-soft`]),
  ["ai", "background"],
  ["ai", "card"],
];

describe.each([":root", ".dark"] as const)("contrast in %s", (selector) => {
  const theme = tokens(selector);

  it.each(PAIRS)("%s on %s is at least 4.5:1", (text, background) => {
    expect(theme[text], `--${text} is not a hex color`).toMatch(/^#/);
    expect(theme[background], `--${background} is not a hex color`).toMatch(/^#/);
    expect(contrast(theme[text], theme[background])).toBeGreaterThanOrEqual(4.5);
  });
});
