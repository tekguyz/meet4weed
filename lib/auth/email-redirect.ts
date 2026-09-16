import { headers } from "next/headers";

/**
 * Where an emailed link lands: `<origin>/auth/confirm` on the origin the
 * request came from, so a link asked for on localhost opens on localhost and
 * one asked for on production opens on production.
 *
 * The origin is not trusted blindly. Supabase checks it against the project's
 * Redirect URLs allowlist and SILENTLY substitutes the Site URL for anything
 * not on it.
 *
 * Server-only (next/headers). A Server Action POST always carries `Origin`;
 * Next.js refuses one whose Origin does not match the host.
 */
export async function emailLinkTarget(): Promise<string | undefined> {
  const origin = (await headers()).get("origin");
  return origin ? `${origin}/auth/confirm` : undefined;
}
