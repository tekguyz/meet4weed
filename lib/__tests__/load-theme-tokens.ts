import { readFileSync } from "node:fs";
import path from "node:path";
import { readBrandColours } from "@/scripts/logo.mjs";

const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

/** The real `:root` and `.light` token blocks from globals.css, put into the
 *  jsdom document, so a test reads the tokens the app ships. */
export function loadThemeTokens() {
  const blocks = [...css.matchAll(/(?:^|\n)(:root|\.light)\s*\{[^}]*\}/g)].map((m) => m[0]);
  const style = document.createElement("style");
  style.textContent = blocks.join("\n");
  document.head.append(style);
  return () => style.remove();
}

/** The --bg of each theme as sRGB hex, converted by the icon script. */
export const EXPECTED_BG = (() => {
  const { dark, light } = readBrandColours(css);
  return { dark: dark.bg, light: light.bg };
})();

export function themeColor() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute("content")?.toLowerCase();
}
