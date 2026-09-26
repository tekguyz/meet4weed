// The Meet4Weed mark, "The Sesh Circle": six friends seen from above, in a ring
// around a leaf. This file is the logo's source. Its geometry lives here and
// its colours come from the tokens in app/globals.css, so the icons never hold
// a colour of their own. scripts/make-icons.mjs renders every icon from it.
//
// Units are a 64 x 64 canvas centred on (32, 32).
import { inflateSync } from "node:zlib";

/** How far the mark reaches from the centre: ring radius 24 + dot radius 5. */
export const MARK_RADIUS = 29;

/** Maskable icons are cropped to a circle or squircle. The safe zone is a
 *  centred circle of 40% of the icon, so the mark is shrunk to sit inside it. */
export const MASKABLE_SCALE = 0.72;

/** iOS rounds the Apple icon's corners only a little, so the mark can be larger. */
export const APPLE_SCALE = 0.8;

const RING = 24;
const DOT = 5;
const LEAF_SCALE = 1.15;
// The leaf, stem included, is centred on the canvas.
const LEAF_AT = [32, 40.3];
// [angle in degrees, length scale] for each of the seven leaflets.
const LEAFLETS = [
  [-80, 0.42],
  [-52, 0.64],
  [-25, 0.86],
  [0, 1],
  [25, 0.86],
  [52, 0.64],
  [80, 0.42],
];
const LEAFLET = "M0 0C5 -6 5 -14 0 -20C-5 -14 -5 -6 0 0Z";

const round = (n) => Math.round(n * 100) / 100;

function shapes(primaryAttr, secondaryAttr) {
  const dots = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `<circle cx="${round(32 + RING * Math.cos(a))}" cy="${round(32 + RING * Math.sin(a))}" r="${DOT}"${secondaryAttr}/>`;
  });
  const [lx, ly] = LEAF_AT;
  const leaflets = LEAFLETS.map(
    ([deg, len]) =>
      `<path d="${LEAFLET}" transform="translate(${lx} ${ly}) rotate(${deg}) scale(${round(len * LEAF_SCALE)})"${primaryAttr}/>`,
  );
  const w = round(2.6 * LEAF_SCALE);
  const stem = `<rect x="${round(lx - w / 2)}" y="${ly - 1}" width="${w}" height="${round(6.5 * LEAF_SCALE)}" rx="${round(w / 2)}"${primaryAttr}/>`;
  return [...dots, ...leaflets, stem].join("");
}

/**
 * The mark as an SVG string.
 * - `field`: fill the whole canvas with this colour (an opaque icon). Omit it
 *   for a transparent icon.
 * - `scale`: shrink the mark about the centre, e.g. into a maskable safe zone.
 * - `lightColours`: switch to these on a light browser tab (SVG favicons only).
 */
export function markSvg({ colours, field, scale = 1, lightColours }) {
  let style = "";
  let primaryAttr = ` fill="${colours.primary}"`;
  let secondaryAttr = ` fill="${colours.secondary}"`;
  if (lightColours) {
    style =
      `<style>.p{fill:${colours.primary}}.s{fill:${colours.secondary}}` +
      `@media (prefers-color-scheme: light){.p{fill:${lightColours.primary}}.s{fill:${lightColours.secondary}}}</style>`;
    primaryAttr = ` class="p"`;
    secondaryAttr = ` class="s"`;
  }
  const bg = field ? `<rect width="64" height="64" fill="${field}"/>` : "";
  const body = scale === 1 ? shapes(primaryAttr, secondaryAttr) : `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${shapes(primaryAttr, secondaryAttr)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${style}${bg}${body}</svg>`;
}

/** "oklch(L% C H)" to "#rrggbb", through OKLab and linear sRGB. */
export function oklchToHex(value) {
  const m = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!m) throw new Error(`Not an oklch() colour: ${value}`);
  const L = Number(m[1]) / 100;
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((x) => {
        const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
        const byte = Math.round(Math.min(1, Math.max(0, v)) * 255);
        return byte.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** The logo's colours, read from the `:root` (dark) and `.light` token blocks. */
export function readBrandColours(css) {
  const block = (selector) => {
    const re = new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`, "g");
    for (const m of css.matchAll(re)) if (/--primary:\s*oklch/.test(m[1])) return m[1];
    throw new Error(`No colour tokens under ${selector} in globals.css`);
  };
  const read = (body, name) => {
    const m = new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(body);
    if (!m) throw new Error(`No --${name} token`);
    return oklchToHex(m[1]);
  };
  const pick = (body) => ({
    bg: read(body, "bg"),
    primary: read(body, "primary"),
    secondary: read(body, "secondary"),
    ink: read(body, "ink"),
    inkMuted: read(body, "ink-muted"),
  });
  return { dark: pick(block(":root")), light: pick(block("\\.light")) };
}

/** Packs PNGs into one .ico file. Each PNG is stored as is, which every
 *  current browser reads. */
export function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/** WOFF 1.0 to a plain TrueType/OpenType font. The renderer behind sharp only
 *  reads the plain kind, and the Nunito package ships WOFF. Each table is
 *  zlib-compressed, or stored as is when that is no smaller. */
export function woffToSfnt(woff) {
  if (woff.toString("latin1", 0, 4) !== "wOFF") throw new Error("Not a WOFF 1.0 font");
  const numTables = woff.readUInt16BE(12);
  const out = Buffer.alloc(woff.readUInt32BE(16));
  out.writeUInt32BE(woff.readUInt32BE(4), 0);
  out.writeUInt16BE(numTables, 4);
  const pow = 2 ** Math.floor(Math.log2(numTables));
  out.writeUInt16BE(pow * 16, 6);
  out.writeUInt16BE(Math.log2(pow), 8);
  out.writeUInt16BE(numTables * 16 - pow * 16, 10);
  let at = 12 + numTables * 16;
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const offset = woff.readUInt32BE(e + 4);
    const compLength = woff.readUInt32BE(e + 8);
    const origLength = woff.readUInt32BE(e + 12);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : raw;
    const r = 12 + i * 16;
    woff.copy(out, r, e, e + 4); // tag
    out.writeUInt32BE(woff.readUInt32BE(e + 16), r + 4); // checksum
    out.writeUInt32BE(at, r + 8);
    out.writeUInt32BE(origLength, r + 12);
    data.copy(out, at);
    at += (origLength + 3) & ~3;
  }
  return out;
}
