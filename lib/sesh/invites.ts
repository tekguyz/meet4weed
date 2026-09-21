import { z } from "zod";

/**
 * The words and the numbers invites are made of.
 *
 * Nothing here enforces anything. Every cap below mirrors a CHECK constraint
 * or a count inside supabase/migrations/…_invites.sql, and the database is
 * what refuses. This module exists so the form, the action and the panel all
 * say the same numbers, and so a zod schema looser than its column can never
 * turn a friendly form error into a 500.
 *
 * No `server-only` and no I/O: the host's panel is a client component and
 * imports these directly.
 */

/** Mirrors invites_max_uses_range. One is the default because a link you
 *  hand to one person is what an invite normally is. */
export const INVITE_USES_MIN = 1;
export const INVITE_USES_MAX = 10;
export const INVITE_USES_DEFAULT = 1;

/** Mirrors the count inside mint_invite(). Shown to the host as a sentence,
 *  never as a progress bar — five links is a ceiling, not a target. */
export const INVITES_PER_SESH = 5;

/** How long a link may live, before the database clamps it to the sesh start.
 *  A link that outlives the thing it leads to is a link to nothing. */
export const INVITE_DAYS_MIN = 1;
export const INVITE_DAYS_MAX = 30;
export const INVITE_DAYS_DEFAULT = 7;

export const INVITE_DAY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

/**
 * THE ONE SENTENCE.
 *
 * Expired, used up, revoked, never existed, a flipped byte in the signature,
 * the wrong person pressing — every one of them renders exactly this. Not
 * because the reasons are hard to tell apart, but because telling them apart
 * is the enumeration signal: a link that says "expired" for a real token and
 * "not found" for a guess is a machine for finding real tokens.
 *
 * Exported as a constant rather than written twice, so the page and the
 * action cannot drift into two sentences.
 */
export const INVITE_FAILED = "That link does not work. Ask the host for a new one.";

/** What a claim looks like to the host, and the only thing it may ever say.
 *  Unverified, waiting on card review, or expired — one derived state, three
 *  possible causes, none of them the host's business. */
export const CLAIMED_NOT_YET = "claimed, not yet able to join";

/** Where a link points. One place builds it, so the route, the copy box and
 *  the sign-in bounce cannot disagree.
 *
 *  `/invite` is the prefix lib/supabase/session.ts already lets a signed-out
 *  visitor through on. Matching it is not cosmetic: the cold path in #31
 *  needs the route to be reachable without a session, and a route named
 *  anything else would be silently gated. */
export function invitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${invitePath(token)}`;
}

/** What the host's mint form posts. `uses` and `days` are both coerced
 *  because a form sends strings, and both are defaulted because a form that
 *  loses a field must mint an ordinary one-use week-long link rather than
 *  fail. */
export const inviteMintSchema = z.object({
  uses: z.coerce
    .number()
    .int("Whole uses only.")
    .min(INVITE_USES_MIN, "A link has to be good for at least one person.")
    .max(INVITE_USES_MAX, `${INVITE_USES_MAX} uses is the most for one link.`)
    .default(INVITE_USES_DEFAULT),
  days: z.coerce
    .number()
    .int("Whole days only.")
    .min(INVITE_DAYS_MIN, "A link has to last at least a day.")
    .max(INVITE_DAYS_MAX, `${INVITE_DAYS_MAX} days is the longest a link can last.`)
    .default(INVITE_DAYS_DEFAULT),
});

export type InviteMintInput = z.infer<typeof inviteMintSchema>;

/** The expiry the host asked for. The database clamps it down to the sesh
 *  start; this never tries to, because the sesh start is not something the
 *  browser is trusted to know. */
export function expiryFromDays(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
