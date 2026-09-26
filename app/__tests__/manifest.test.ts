import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { readBrandColours } from "@/scripts/logo.mjs";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";

const root = path.resolve(import.meta.dirname, "../..");
const m = manifest();

describe("the web app manifest (#51)", () => {
  it("names the app and opens without browser chrome", () => {
    expect(m.name).toBe(APP_NAME);
    expect(m.short_name).toBe(APP_NAME);
    expect(m.description).toBe(APP_TAGLINE);
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
  });

  // The splash is one static value that cannot follow a theme. Dark is the
  // default, so a dark splash before a light app is the less jarring way round.
  it("splashes on the dark field, read from the --bg token rather than typed in", () => {
    const { dark } = readBrandColours(readFileSync(path.join(root, "app/globals.css"), "utf8"));
    expect(m.background_color?.toLowerCase()).toBe("#14120e");
    expect(m.background_color).toBe(dark.bg);
  });

  it("lists every icon from the logo ticket, including the maskable one", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => `${i.src} ${i.sizes} ${i.purpose ?? "any"}`)).toEqual([
      "/icon.svg any any",
      "/icon-192.png 192x192 any",
      "/icon-512.png 512x512 any",
      "/icon-maskable-512.png 512x512 maskable",
    ]);
  });

  // public/sw.js is a plain script and cannot import the manifest, so the
  // icon list is written twice. This keeps the two in step.
  it("names only icons the service worker also caches", () => {
    const sw = readFileSync(path.join(root, "public/sw.js"), "utf8");
    const cached = JSON.parse(sw.match(/const ICONS = (\[[^\]]*\]);/)![1]) as string[];
    for (const { src } of m.icons ?? []) expect(cached).toContain(src);
  });

  it("points only at icons that exist", () => {
    for (const { src } of m.icons ?? []) {
      const file = src.slice(1);
      expect(existsSync(path.join(root, "public", file)) || existsSync(path.join(root, "app", file))).toBe(true);
    }
  });
});
