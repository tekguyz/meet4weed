import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Paths a signed-out visitor may reach. Everything else redirects to /login.
 *  /auth MUST be here: /auth/confirm opens an emailed link before a session
 *  exists. /api/cron is called by Vercel Cron, which has no session; each cron
 *  route checks CRON_SECRET itself. Help, Terms, Privacy and Community rules
 *  are read before a person has an account (issue #68). The offline page
 *  holds nothing from the database (#51). */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/invite",
  "/api/cron",
  // 404 outside development; in development it is how a signed-out agent
  // signs in (app/api/dev-login/route.ts).
  "/api/dev-login",
  "/help",
  "/terms",
  "/privacy",
  "/rules",
  // The service worker caches it at install, and a visitor on /login installs
  // the worker too. Gated, it would cache the sign-in page instead (#51).
  "/offline",
  // A crawler has no session. It must read robots.txt to see that every page
  // but the landing page is noindex (#97).
  "/robots.txt",
  "/sitemap.xml",
];

/** The landing page's internal route (#97). A signed-out visitor on exactly
 *  `/` is rewritten to it, so the URL stays `/`. A direct request for it goes
 *  to `/`, for everyone, so the page has one address. */
export const LANDING_PATH = "/landing";

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

  const { pathname } = request.nextUrl;

  if (pathname === LANDING_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withCookies(NextResponse.redirect(url), response);
  }

  // Exactly `/`, never a prefix: no other path becomes public by accident. A
  // member on `/` is not touched; the Frame's home decides where they go.
  if (!user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = LANDING_PATH;
    return withCookies(NextResponse.rewrite(url, { request }), response);
  }

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

/** A rotated auth cookie rides on whatever response the gate returns. */
function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}
