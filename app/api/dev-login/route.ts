import path from "node:path";
import { NextResponse } from "next/server";
import { floridaToday } from "@/lib/dates";
import {
  devRoleFrom,
  ensureDevPassword,
  prepareDevAccount,
  safeRedirectTarget,
  signInDevAccount,
  supabaseDevStore,
} from "@/lib/dev-login";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** DEV ONLY. Signs in dev@meet4weed.test on the server and sets the session
 *  cookie, so an agent driving the browser pane reaches signed-in pages
 *  without typing a password. A real sign-in, not a bypass: RLS applies.
 *  Creates the account first when it is missing, so it survives a
 *  delete-account test. Then it walks the account past every gate —
 *  onboarded, verified for a year — so every member screen opens; `?as=admin`
 *  also makes it an admin (issue #90). `?next=/path` lands there instead of
 *  `/`. The proxy lets it through signed-out (lib/supabase/session.ts). */
export async function GET(request: Request) {
  // Allowlist, not `!== "production"`: an unset or odd NODE_ENV means no route.
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const password = ensureDevPassword(
    path.join(process.cwd(), ".env.local"),
    serverEnv().DEV_LOGIN_PASSWORD,
  );
  const session = await createClient();
  const result = await signInDevAccount(session, createAdminClient, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  const { data } = await session.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Signed in, but no user came back" }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const prepared = await prepareDevAccount(
    supabaseDevStore(createAdminClient()),
    data.user.id,
    devRoleFrom(params.get("as")),
    floridaToday(),
  );
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 500 });

  return NextResponse.redirect(safeRedirectTarget(request.url, params.get("next")));
}
