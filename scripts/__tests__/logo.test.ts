import { readFileSync } from "node:fs";
import path from "node:path";
import {
  icoFromPngs,
  MARK_RADIUS,
  MASKABLE_SCALE,
  markSvg,
  oklchToHex,
  readBrandColours,
  woffToSfnt,
} from "../logo.mjs";

const css = readFileSync(path.resolve("app/globals.css"), "utf8");

describe("oklchToHex", () => {
  it("matches the hex noted beside each token in globals.css", () => {
    expect(oklchToHex("oklch(18.31% 0.0085 84.57)")).toBe("#14120e");
    expect(oklchToHex("oklch(83.85% 0.1202 127.58)")).toBe("#b4d982");
    expect(oklchToHex("oklch(81.04% 0.1127 80.25)")).toBe("#e7b968");
    expect(oklchToHex("oklch(55.50% 0.1076 129.11)")).toBe("#5f7f36");
  });
});

describe("readBrandColours", () => {
  it("reads the logo colours from the dark and light token blocks", () => {
    expect(readBrandColours(css)).toEqual({
      dark: {
        bg: "#14120e",
        primary: "#b4d982",
        secondary: "#e7b968",
        ink: "#f5f0e4",
        inkMuted: "#a79b87",
      },
      light: {
        bg: "#faf6ec",
        primary: "#5f7f36",
        secondary: "#a9761f",
        ink: "#1c1913",
        inkMuted: "#6b6252",
      },
    });
  });
});

describe("markSvg", () => {
  const { dark, light } = readBrandColours(css);

  it("is transparent when no field is given", () => {
    const svg = markSvg({ colours: dark });
    expect(svg).not.toContain('<rect width="64" height="64"');
    expect(svg).toContain(dark.primary);
    expect(svg).toContain(dark.secondary);
  });

  it("fills the whole canvas when a field is given", () => {
    const svg = markSvg({ colours: dark, field: dark.bg, scale: MASKABLE_SCALE });
    expect(svg).toContain(`<rect width="64" height="64" fill="${dark.bg}"/>`);
  });

  it("keeps the maskable mark inside the safe zone, a circle of 40% of the icon", () => {
    expect(MARK_RADIUS * MASKABLE_SCALE).toBeLessThanOrEqual(0.4 * 64);
  });

  it("swaps to the light colours on a light browser tab", () => {
    const svg = markSvg({ colours: dark, lightColours: light });
    expect(svg).toContain("prefers-color-scheme: light");
    expect(svg).toContain(light.primary);
  });
});

describe("icoFromPngs", () => {
  it("writes an ICO header and one directory entry per image", () => {
    const a = Buffer.from([1, 2, 3]);
    const b = Buffer.from([4, 5]);
    const ico = icoFromPngs([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[6 + 16]).toBe(0); // 256 is written as 0
    const firstOffset = ico.readUInt32LE(6 + 12);
    expect(firstOffset).toBe(6 + 16 * 2);
    expect(ico.subarray(firstOffset, firstOffset + 3)).toEqual(a);
    expect(ico.length).toBe(6 + 32 + 5);
  });
});

describe("woffToSfnt", () => {
  it("unpacks the Nunito WOFF into a TrueType font", () => {
    const woff = readFileSync(
      path.resolve("node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff"),
    );
    const ttf = woffToSfnt(woff);
    const tables = ttf.readUInt16BE(4);
    expect(ttf.readUInt32BE(0)).toBe(woff.readUInt32BE(4)); // the WOFF's flavor
    expect(tables).toBe(woff.readUInt16BE(12));
    expect(ttf.length).toBe(woff.readUInt32BE(16)); // totalSfntSize
    const tags = Array.from({ length: tables }, (_, i) => ttf.toString("latin1", 12 + i * 16, 16 + i * 16));
    expect(tags).toContain("glyf");
  });
});
