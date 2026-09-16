import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Where the magic link lands. Exchanges the one-time code for a session
 *  cookie, then sends the member on. A failed exchange is an expired or reused
 *  link, which is normal — not an error page.
 *
 *  `next` is resolved against the request origin and then checked: an
 *  attacker-supplied absolute URL would otherwise turn our own auth callback
 *  into an open redirect that arrives with a fresh session attached. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requested = request.nextUrl.searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("expired", "1");
  return NextResponse.redirect(url);
}
