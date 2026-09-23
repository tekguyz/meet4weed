import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT } from "@/lib/theme-boot";

/** The inline script is the function's own source. This proves the string
 *  runs on its own, with nothing from the module around it. */
function runScript() {
  new Function(THEME_BOOT)();
}

function osPrefersLight(light: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: light && q.includes("light") }));
}

describe("THEME_BOOT", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light");
    vi.unstubAllGlobals();
  });

  it("leaves dark alone, the default", () => {
    osPrefersLight(false);
    runScript();
    expect(document.documentElement).not.toHaveClass("light");
  });

  it("adds light for an explicit choice", () => {
    osPrefersLight(false);
    localStorage.setItem("theme", "light");
    runScript();
    expect(document.documentElement).toHaveClass("light");
  });

  it("follows a light OS when no choice is stored", () => {
    osPrefersLight(true);
    runScript();
    expect(document.documentElement).toHaveClass("light");
  });

  it("keeps an explicit dark on a light OS", () => {
    osPrefersLight(true);
    localStorage.setItem("theme", "dark");
    runScript();
    expect(document.documentElement).not.toHaveClass("light");
  });
});
