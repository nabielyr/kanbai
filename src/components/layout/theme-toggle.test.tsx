import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, THEME_SCRIPT } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";

let deviceDark = false;
const changeListeners = new Set<() => void>();

beforeEach(() => {
  localStorage.clear();
  deviceDark = false;
  document.documentElement.className = "";
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return deviceDark;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => changeListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => changeListeners.delete(fn),
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  changeListeners.clear();
});

const isDark = () => document.documentElement.classList.contains("dark");

async function choose(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole("button", { name: "Theme" }));
  await user.click(await screen.findByRole("menuitemradio", { name: option }));
}

describe("ThemeToggle", () => {
  it("switches to dark and back, remembering the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await choose(user, "Dark");
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    await choose(user, "Light");
    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("follows the device when set to match it, also when the device switches", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_KEY, "light");
    render(<ThemeToggle />);

    deviceDark = true;
    await choose(user, "Same as device");
    expect(isDark()).toBe(true);

    deviceDark = false;
    act(() => changeListeners.forEach((fn) => fn()));
    expect(isDark()).toBe(false);
  });

  it("marks the current choice in the menu", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_KEY, "dark");
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Theme" }));
    expect(await screen.findByRole("menuitemradio", { name: "Dark" })).toBeChecked();
  });
});

describe("THEME_SCRIPT", () => {
  // The inline script must agree with the hook before React loads.
  it.each([
    ["dark", false, true],
    ["light", true, false],
    [null, true, true],
    [null, false, false],
  ] as const)("stored %s, device dark %s → dark %s", (stored, device, expected) => {
    if (stored) localStorage.setItem(THEME_KEY, stored);
    deviceDark = device;
    new Function(THEME_SCRIPT)();
    expect(isDark()).toBe(expected);
    expect(document.documentElement.style.colorScheme).toBe(expected ? "dark" : "light");
  });
});
