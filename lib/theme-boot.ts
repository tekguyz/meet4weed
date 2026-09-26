/**
 * Copies the live --bg token into the `theme-color` meta, which paints the
 * browser's top bar and Android's nav bar. The meta needs sRGB hex and cannot
 * read a CSS variable or oklch(), so this reads the computed token and converts
 * it. No hex value is written in the codebase, and the bar can never drift
 * from the token.
 *
 * The token arrives in one of three forms. globals.css writes oklch(), which
 * is what jsdom sees. The build (Lightning CSS) rewrites it as lab() for a
 * browser that supports lab(), with a hex fallback for one that does not; a
 * hex value passes straight through. The oklch() maths is oklchToHex in
 * scripts/logo.mjs, which the test holds it to.
 *
 * Self-contained on purpose: THEME_BOOT inlines its source.
 */
export function syncThemeColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  // A minifier or jsdom may drop a leading zero, or the space after "%".
  const num = "(-?[\\d.]+)";
  const ok = new RegExp(`^oklch\\(\\s*${num}(%?)\\s*${num}\\s*${num}`).exec(value);
  const lab = new RegExp(`^lab\\(\\s*${num}%?\\s*${num}\\s*${num}`).exec(value);
  let linear: number[] | undefined;
  if (ok) {
    const L = Number(ok[1]) / (ok[2] ? 100 : 1);
    const C = Number(ok[3]);
    const h = (Number(ok[4]) * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    linear = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  } else if (lab) {
    // CIE Lab (D50) to XYZ, then to linear sRGB with the D50-to-D65 step
    // folded into the matrix. Constants from CSS Color 4's sample code.
    const fy = (Number(lab[1]) + 16) / 116;
    const f = [fy + Number(lab[2]) / 500, fy, fy - Number(lab[3]) / 200];
    const [X, Y, Z] = f.map((t, i) => (t > 6 / 29 ? t ** 3 : (116 * t - 16) / 903.2962962) * [0.3457 / 0.3585, 1, 0.2958 / 0.3585][i]);
    linear = [
      3.1341359569958707 * X - 1.6173863321612538 * Y - 0.4906619460083532 * Z,
      -0.978795502912089 * X + 1.916254567259524 * Y + 0.03344273116131949 * Z,
      0.07195537988411677 * X - 0.2289768264158322 * Y + 1.405386058324125 * Z,
    ];
  }
  // Without oklch() or lab(), the build's hex fallback passes straight through.
  const hex = linear
    ? "#" +
      linear
        .map((x) => {
          const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
          return Math.round(Math.min(1, Math.max(0, v)) * 255)
            .toString(16)
            .padStart(2, "0");
        })
        .join("")
    : value;
  if (!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(hex)) return;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = hex;
}

/** Dark is the default, so .light goes on only for an explicit "light"
 *  choice, or for a "system" choice on a light OS. It then paints the
 *  bars to match, and follows the phone if it switches theme while the app is
 *  open. Shared by the root layout and global-error, which replaces it.
 *
 *  Returns a cleanup, so global-error can pass it straight to useEffect. */
export function bootTheme(sync: () => void = syncThemeColor) {
  let media: MediaQueryList | undefined;
  function apply() {
    try {
      const stored = localStorage.getItem("theme");
      document.documentElement.classList.toggle(
        "light",
        stored === "light" || (stored !== "dark" && !!media?.matches),
      );
    } catch {
      // Private mode can block storage. Dark stands.
    }
    sync();
  }
  try {
    media = matchMedia("(prefers-color-scheme:light)");
    media.addEventListener("change", apply);
  } catch {
    // No matchMedia: dark stands unless light was chosen.
  }
  apply();
  return () => media?.removeEventListener("change", apply);
}

/** The same code as an inline script, so it runs before paint. The helper is
 *  passed in, because the inlined function cannot import it. */
export const THEME_BOOT = `(${bootTheme.toString()})(${syncThemeColor.toString()})`;
