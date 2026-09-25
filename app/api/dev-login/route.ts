import path from "node:path";
import { NextResponse } from "next/server";
import { ensureDevAccount, ensureDevPassword } from "@/lib/dev-login";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** DEV ONLY. Signs in dev@meet4weed.test on the server and sets the session
 *  cookie, so an agent driving the browser pane reaches signed-in pages
 *  without typing a password. A real sign-in, not a bypass: RLS applies.
 *  Creates the account first when it is missing, so it survives a
 *  delete-account test. `?next=/path` lands there instead of `/`.
 *  The proxy lets it through signed-out (lib/supabase/session.ts). */
export async function GET(request: Request) {
  // Allowlist, not `!== "production"`: an unset or odd NODE_ENV means no route.
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const password = ensureDevPassword(
    path.join(process.cwd(), ".env.local"),
    serverEnv().DEV_LOGIN_PASSWORD,
  );
  const result = await ensureDevAccount(await createClient(), createAdminClient, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  // Same origin only, checked after parsing: `//evil.example` and
  // `/\evil.example` both parse to a foreign host, so a prefix check is not
  // enough. Anything off this origin falls back to `/`.
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  let target = new URL("/", url.origin);
  try {
    const resolved = next ? new URL(next, url.origin) : null;
    if (resolved && resolved.origin === url.origin) target = resolved;
  } catch {
    // Unparseable — stay on `/`.
  }
  return NextResponse.redirect(target);
}
