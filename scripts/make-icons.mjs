// Renders every icon from the mark in scripts/logo.mjs, in the colours of the
// tokens in app/globals.css. Re-run after changing either.
//
//   npm run icons
//
// Two transparency rules, same logo (#49). The favicon and icon.svg are
// transparent, to sit on a browser tab of any colour. The maskable and Apple
// icons are opaque on the dark field, because a launcher crops them and a
// transparent icon shows the wallpaper through it.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { icoFromPngs, MASKABLE_SCALE, markSvg, readBrandColours, woffToSfnt } from "./logo.mjs";

const root = path.resolve(import.meta.dirname, "..");
const out = (p) => path.join(root, p);
const { dark, light } = readBrandColours(readFileSync(out("app/globals.css"), "utf8"));

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * (size / 64) * 2 }).resize(size, size).png().toBuffer();

// Transparent: the SVG favicon also switches colours on a light tab.
writeFileSync(out("app/icon.svg"), markSvg({ colours: dark, lightColours: light }) + "\n");
const flat = markSvg({ colours: dark });
writeFileSync(
  out("app/favicon.ico"),
  icoFromPngs(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await png(flat, size) })))),
);
writeFileSync(out("public/icon-192.png"), await png(flat, 192));
writeFileSync(out("public/icon-512.png"), await png(flat, 512));

// Opaque on the dark field.
const opaque = markSvg({ colours: dark, field: dark.bg, scale: MASKABLE_SCALE });
writeFileSync(out("public/icon-maskable-512.png"), await png(opaque, 512));
writeFileSync(out("app/apple-icon.png"), await png(markSvg({ colours: dark, field: dark.bg, scale: 0.8 }), 180));

// Link preview, 1200 x 630: the mark, the Nunito wordmark and the tagline.
const fontDir = mkdtempSync(path.join(tmpdir(), "m4w-font-"));
const font = (w) => {
  const file = path.join(fontDir, `nunito-${w}.ttf`);
  const woff = readFileSync(out(`node_modules/@fontsource/nunito/files/nunito-latin-${w}-normal.woff`));
  writeFileSync(file, woffToSfnt(woff));
  return file;
};
// Each Nunito file names its own family by weight, e.g. "Nunito ExtraBold".
const FAMILY = { 600: "Nunito SemiBold", 800: "Nunito ExtraBold" };
const text = (t, w, px, colour, width) =>
  sharp({
    text: {
      text: `<span foreground="${colour}">${t}</span>`,
      font: `${FAMILY[w]} ${px}px`,
      fontfile: font(w),
      rgba: true,
      dpi: 72,
      ...(width ? { width } : {}),
    },
  })
    .png()
    .toBuffer();
// The tagline is read from lib/env.ts so the preview never drifts from it.
const tagline = /APP_TAGLINE =\s*"([^"]+)"/.exec(readFileSync(out("lib/env.ts"), "utf8"))[1];
const [word, tag, mark] = await Promise.all([
  text("meet4weed", 800, 108, dark.ink),
  text(tagline, 600, 32, dark.inkMuted, 560),
  png(flat, 300),
]);
rmSync(fontDir, { recursive: true, force: true });
const [wm, tm] = await Promise.all([sharp(word).metadata(), sharp(tag).metadata()]);
const left = 450;
const top = Math.round((630 - wm.height - 24 - tm.height) / 2);
writeFileSync(
  out("app/opengraph-image.png"),
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: dark.bg } })
    .composite([
      { input: mark, left: 110, top: 165 },
      { input: word, left, top },
      { input: tag, left: left + 6, top: top + wm.height + 24 },
    ])
    .png()
    .toBuffer(),
);

console.log("Icons written: app/icon.svg, app/favicon.ico, app/apple-icon.png, app/opengraph-image.png, public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png");
