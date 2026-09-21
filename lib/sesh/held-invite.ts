import "server-only";
import { cookies } from "next/headers";
import { invitePath } from "@/lib/sesh/invites";

/**
 * The cookie that lets an invite link survive a sign-up.
 *
 * Somebody with no account opens a link, presses the button, and there is
 * nobody yet to spend a use for. The token is put here instead, they sign up,
 * and they come back to the same page and press it again. THAT press spends
 * the use. There is no automatic spend during a redirect — one rule, one
 * place, and a redirect is the hardest thing in the app to debug when a
 * second invisible way to spend a use goes wrong.
 *
 * THE COOKIE ONLY HAS TO SURVIVE SIGN-UP. Minutes, not the card review, which
 * is days. The claim that waits across the review is a row in
 * public.invite_claims, written on the second press by a member who is still
 * unverified. Losing this cookie after that press costs the member nothing.
 *
 * THE VALUE IS THE TOKEN, AND THE TOKEN IS ALREADY A SIGNED VALUE:
 * base64url(random) "." base64url(HMAC-SHA256 over it) — see
 * lib/sesh/invite-token.ts. Wrapping it in a second signature would be a
 * second key guarding the same fact. A flipped byte fails
 * verifyInviteToken() at the seam that already rejects every other dead
 * link, and the person reads INVITE_FAILED — the same one sentence.
 *
 * Nothing here verifies the tag. That is deliberate: a tampered cookie has to
 * reach the invite page and get the SAME sentence as an expired link, a
 * revoked link and a link that never existed. Shape is all that is checked,
 * and only so a junk cookie cannot become a path.
 */
export const HELD_INVITE_COOKIE = "m4w_held_invite";

/** Long enough to open an email and pick a password, short enough that a
 *  shared or borrowed browser is not carrying somebody else's link around. */
export const HELD_INVITE_MAX_AGE = 30 * 60;

/** base64url "." base64url, and nothing else. A token is 16 random bytes and
 *  a SHA-256 tag, so the real thing is ~65 characters; the cap is slack, not
 *  a measurement. This is a shape check, NOT a signature check. */
const SHAPE = /^[A-Za-z0-9_-]{1,128}\.[A-Za-z0-9_-]{1,128}$/;

/** Hold the token across sign-up. `httpOnly` keeps it out of any script,
 *  `sameSite: "lax"` keeps another site from steering the bounce, and
 *  `secure` is off only for plain-http `next dev`. */
export async function holdInvite(token: string): Promise<void> {
  if (!SHAPE.test(token)) return;
  (await cookies()).set(HELD_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HELD_INVITE_MAX_AGE,
  });
}

/**
 * Where to send somebody who has just signed in or confirmed their email, or
 * null when no link is waiting.
 *
 * A token is base64url and a dot, so `invitePath` encodes it into a single
 * path segment and a crafted cookie cannot become an off-site redirect.
 */
export async function heldInvitePath(): Promise<string | null> {
  const token = (await cookies()).get(HELD_INVITE_COOKIE)?.value;
  if (!token || !SHAPE.test(token)) return null;
  return invitePath(token);
}

/** Called once the press has happened. The claim is a row now, so the cookie
 *  has no job left. */
export async function releaseHeldInvite(): Promise<void> {
  (await cookies()).delete(HELD_INVITE_COOKIE);
}
