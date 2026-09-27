import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Next.js 16 renamed the `middleware` convention to `proxy`; the export name
 *  moved with it. Runtime is nodejs and is not configurable here. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every path except static assets, image files, the face detector's
    // runtime (public/mediapipe/, ~12 MB, fetched on the verify face step) and
    // MapLibre's worker (public/maplibre/). The worker must come back as
    // JavaScript; a redirect to /login would hand the browser HTML instead and
    // the map would silently draw no tiles.
    // The service worker and the manifest (#51) are the same: a browser asks
    // for both signed out, and a redirect would hand it the /login page.
    // All of /_next/ is framework plumbing, not a page. In development that
    // includes the /_next/hmr socket: redirected to /login, it stops a
    // signed-out page from ever starting its scripts (#97).
    // Auth cookies rotate on the request that needs them, so the matcher
    // stays broad.
    "/((?!_next/|favicon.ico|mediapipe/|maplibre/|sw.js$|manifest.webmanifest$|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
