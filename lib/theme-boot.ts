/** Dark is the default, so this only ever ADDS .light — for an explicit
 *  "light" choice, or for a "system" choice on a light OS. Shared by the root
 *  layout and global-error, which replaces it. */
export function bootTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || (stored !== "dark" && matchMedia("(prefers-color-scheme:light)").matches)) {
      document.documentElement.classList.add("light");
    }
  } catch {
    // Private mode can block storage. Dark stands.
  }
}

/** The same code as an inline script, so it runs before paint. */
export const THEME_BOOT = `(${bootTheme.toString()})()`;
