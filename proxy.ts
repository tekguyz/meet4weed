import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Next.js 16 renamed the `middleware` convention to `proxy`; the export name
 *  moved with it. Runtime is nodejs and is not configurable here. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every path except static assets, image files and the face detector's
    // runtime (public/mediapipe/, ~12 MB, fetched on the verify face step).
    // Auth cookies rotate on the request that needs them, so the matcher
    // stays broad.
    "/((?!_next/static|_next/image|favicon.ico|mediapipe/|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
