import { readFileSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import { readBrandColours } from "@/scripts/logo.mjs";

/**
 * What makes the app installable (#51). A typed route, not a static
 * public/manifest.json, so it has a type and a test.
 *
 * The splash colour is a single static value that cannot follow a theme. Dark
 * is the default, so a dark splash before a light app is the less jarring way
 * round. It is read from the --bg token, the way `npm run icons` reads the
 * icon colours, so no hex value enters the codebase. The route is built once,
 * at build time.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { dark } = readBrandColours(readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8"));
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: dark.bg,
    theme_color: dark.bg,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Opaque edge to edge, so a launcher can crop it into a circle.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
