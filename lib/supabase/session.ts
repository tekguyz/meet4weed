import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Paths a signed-out visitor may reach. Everything else redirects to /login.
 *  /auth MUST be here: /auth/confirm opens an emailed link before a session
 *  exists. /api/cron is called by Vercel Cron, which has no session; each cron
 *  route checks CRON_SECRET itself. Help, Terms, Privacy and Community rules
 *  are read before a person has an account (issue #68). */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/invite",
  "/api/cron",
  "/help",
  "/terms",
  "/privacy",
  "/rules",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Refreshes the auth cookie on every request and gates protected routes.
 *
 *  getUser(), not getSession(): getSession only decodes the cookie, which a
 *  client can forge. getUser round-trips to the auth server, so the answer is
 *  trustworthy. This is the one place that cost is worth paying. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
