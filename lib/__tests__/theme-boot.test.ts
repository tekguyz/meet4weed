import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT, syncThemeColor } from "@/lib/theme-boot";
import { EXPECTED_BG, loadThemeTokens, themeColor } from "./load-theme-tokens";

/** The inline script is the function's own source. This proves the string
 *  runs on its own, with nothing from the module around it. */
function runScript() {
  new Function(THEME_BOOT)();
}

type Listener = () => void;
let osListeners: Listener[] = [];
let osLight = false;

/** A fake phone setting that can flip while the page is open. */
function osPrefersLight(light: boolean) {
  osLight = light;
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() {
      return osLight && q.includes("light");
    },
    addEventListener: (_: string, fn: Listener) => osListeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => (osListeners = osListeners.filter((l) => l !== fn)),
  }));
}

function flipOs(light: boolean) {
  osLight = light;
  osListeners.forEach((fn) => fn());
}

let unloadTokens: () => void;

beforeEach(() => {
  unloadTokens = loadThemeTokens();
});

afterEach(() => {
  unloadTokens();
  localStorage.clear();
  document.documentElement.classList.remove("light");
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  osListeners = [];
  vi.unstubAllGlobals();
});

describe("syncThemeColor", () => {
  it("writes the dark --bg as hex", () => {
    syncThemeColor();
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });

  it("writes the light --bg as hex", () => {
    document.documentElement.classList.add("light");
    syncThemeColor();
    expect(themeColor()).toBe(EXPECTED_BG.light);
  });

  // The build rewrites the token: lab() for a browser that has it, and a hex
  // fallback for one that does not. These are the strings it emits for --bg.
  it.each([
    ["dark", "lab(5.56703% .278473 2.36959)"],
    ["light", "lab(96.9922% .111938 5.32708)"],
  ] as const)("converts the built lab() form of the %s --bg", (theme, built) => {
    document.documentElement.style.setProperty("--bg", built);
    syncThemeColor();
    document.documentElement.style.removeProperty("--bg");
    expect(themeColor()).toBe(EXPECTED_BG[theme]);
  });

  it("passes the built hex fallback straight through", () => {
    document.documentElement.style.setProperty("--bg", EXPECTED_BG.light);
    syncThemeColor();
    document.documentElement.style.removeProperty("--bg");
    expect(themeColor()).toBe(EXPECTED_BG.light);
  });

  it("leaves the meta alone when it cannot read the token", () => {
    document.documentElement.style.setProperty("--bg", "color-mix(in srgb, red, blue)");
    syncThemeColor();
    document.documentElement.style.removeProperty("--bg");
    expect(themeColor()).toBeUndefined();
  });

  it("updates the one meta tag, never adds a second", () => {
    syncThemeColor();
    document.documentElement.classList.add("light");
    syncThemeColor();
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(themeColor()).toBe(EXPECTED_BG.light);
  });
});

describe("THEME_BOOT", () => {
  it("leaves dark alone, the default", () => {
    osPrefersLight(false);
    runScript();
    expect(document.documentElement).not.toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });

  it("adds light for an explicit choice", () => {
    osPrefersLight(false);
    localStorage.setItem("theme", "light");
    runScript();
    expect(document.documentElement).toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.light);
  });

  it("follows a light OS when no choice is stored", () => {
    osPrefersLight(true);
    runScript();
    expect(document.documentElement).toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.light);
  });

  it("keeps an explicit dark on a light OS", () => {
    osPrefersLight(true);
    localStorage.setItem("theme", "dark");
    runScript();
    expect(document.documentElement).not.toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });

  it("follows the phone when it switches theme while the app is open", () => {
    osPrefersLight(false);
    runScript();

    flipOs(true);
    expect(document.documentElement).toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.light);

    flipOs(false);
    expect(document.documentElement).not.toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });

  it("ignores the phone's switch when a theme was chosen", () => {
    osPrefersLight(false);
    localStorage.setItem("theme", "dark");
    runScript();

    flipOs(true);
    expect(document.documentElement).not.toHaveClass("light");
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });
});
