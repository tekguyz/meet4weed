"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import type { ActionState } from "@/lib/forms/action-state";
import { floridaToday } from "@/lib/dates";
import { APP_URL } from "@/lib/env";
import { inviteLimitsFromEnv } from "@/lib/sesh/invite-limits";
import { holdInvite, releaseHeldInvite } from "@/lib/sesh/held-invite";
import { hashInviteToken, mintInviteToken, verifyInviteToken } from "@/lib/sesh/invite-token";
import {
  canBrowse,
  INVITE_FAILED,
  INVITES_PER_SESH,
  INVITE_USES_MAX,
  expiryFromDays,
  inviteMintSchema,
  inviteUrl,
} from "@/lib/sesh/invites";

/**
 * Minting a link, revoking one, and spending a use.
 *
 * Every rule lives in Postgres — see supabase/migrations/…_invites.sql. Who
 * may mint, the five-live-links cap, the expiry clamp, who is refused, and
 * the atomic spend under a row lock: all of it is decided there. The only
 * jobs here are to turn a SQLSTATE into a sentence, to keep the token out of
 * the database, and to count presses per IP.
 *
 * THE TOKEN IS MINTED HERE AND HASHED BEFORE IT CROSSES THE BOUNDARY. The
 * database is handed sha256(token) and never the token, so no column, no log
 * line and no query string can leak a live link. The host sees it once, in
 * the reply to mintInvite, and thereafter only as a path segment in whatever
 * they pasted it into.
 */

const seshId = z.uuid();
const inviteId = z.uuid();

/** ONE sentence for every way redeeming can fail — expired, used up,
 *  revoked, never existed, a flipped byte in the tag, the wrong person
 *  pressing. Telling them apart is the enumeration signal. */
const MESSAGES: Record<string, string> = {
  M4W10: "Your card is not current. Renew it and you can make links again.",
  M4W19: INVITE_FAILED,
  M4W20: "You cannot make a link for that sesh.",
  M4W21: `${INVITES_PER_SESH} live links is the most for one sesh. Revoke one to make another.`,
  M4W22: `Pick between 1 and ${INVITE_USES_MAX} uses, and a date in the future.`,
};

const FALLBACK = "Could not do that just now. Try again.";

function readable(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}

async function callerOrNull() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** What a mint hands back. `url` is the ONE time the token exists outside the
 *  host's clipboard — it is not stored, not revalidated into a cache, and not
 *  readable again from anywhere. */
export type MintState = ActionState & { url?: string };

export async function mintInvite(_prev: MintState | null, formData: FormData): Promise<MintState> {
  const sesh = seshId.safeParse(formData.get("seshId"));
  if (!sesh.success) return { ok: false, message: "Could not find that sesh." };

  const parsed = inviteMintSchema.safeParse({
    uses: formData.get("uses") ?? undefined,
    days: formData.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check what you picked." };
  }

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };
  const { supabase } = caller;

  const token = mintInviteToken(serverEnv().VERIFICATION_SECRET);

  const { error } = await supabase.rpc("mint_invite", {
    p_sesh: sesh.data,
    p_token_hash: hashInviteToken(token),
    p_max_uses: parsed.data.uses,
    p_expires_at: expiryFromDays(parsed.data.days),
  });
  if (error) return { ok: false, message: readable(error.code) };

  // A Server Action POST always carries Origin, and Next.js refuses one whose
  // Origin does not match the host — see lib/auth/email-redirect.ts. APP_URL
  // is the belt to that braces, so a host never copies a link with no origin.
  const origin = (await headers()).get("origin") || APP_URL;

  revalidatePath(`/seshes/${sesh.data}`);
  return {
    ok: true,
    message: "Here is the link. Copy it now — you will not see it again.",
    url: inviteUrl(origin, token),
  };
}

export async function revokeInvite(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const invite = inviteId.safeParse(formData.get("inviteId"));
  const sesh = seshId.safeParse(formData.get("seshId"));
  if (!invite.success || !sesh.success) return { ok: false, message: "Could not find that link." };

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };

  const { error } = await caller.supabase.rpc("revoke_invite", { p_invite: invite.data });
  if (error) return { ok: false, message: readable(error.code) };

  revalidatePath(`/seshes/${sesh.data}`);
  return { ok: true, message: "Revoked. Anyone who already used it stays." };
}

/**
 * THE POST. This is the only thing in the app that spends a use, and it is
 * reached by a signed-in human pressing a button — never by a page load and
 * never by a redirect.
 *
 * TWO PRESSES CAN HAPPEN, AND ONLY THE SECOND ONE SPENDS ANYTHING.
 *
 *   1. Pressed with no account. There is nobody to spend a use FOR, so
 *      nothing is spent. The token goes into a short-lived httpOnly cookie
 *      (lib/sesh/held-invite.ts) and the person is sent to sign up. The
 *      redirect carries no token: not in the path, not in a query string.
 *   2. Pressed again after signing up, now signed in. THAT press spends the
 *      use and writes the claim.
 *
 * There is no third, invisible way. A redirect that spent a use would be the
 * hardest thing in this app to debug the day it went wrong, and the cost of
 * refusing to build it is one extra button press.
 *
 * The tag is verified BEFORE the rate limiter and before the database: a
 * flipped byte costs an attacker a round trip to this server and nothing
 * more. Every failure below returns the same sentence.
 *
 * SUCCESS REDIRECTS FROM HERE, the way app/auth/actions/email-link.ts does,
 * and it has to. Returning a destination for the page to navigate to left the
 * successful redeemer looking at "that link does not work": the action's reply
 * re-renders the invite page, the link they just spent is no longer live, and
 * the preview that draws that page correctly returns nothing. The person who
 * did everything right read the failure sentence. `redirect` throws, so
 * nothing below it runs and no such render happens; a failure returns above
 * it and never reaches it.
 */
export async function redeemInvite(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");

  // Checked before anything else, and before we know who is pressing. A bad
  // tag is the same dead link for a stranger and for a member, and a cookie
  // must never be set for one.
  if (!token || !verifyInviteToken(serverEnv().VERIFICATION_SECRET, token)) {
    return { ok: false, message: INVITE_FAILED };
  }

  const caller = await callerOrNull();

  // THE COLD PATH. Nothing is spent, nothing is written, and the database is
  // not touched at all — there is no member yet for a claim to belong to.
  // Hold the token and send them to make an account.
  if (!caller) {
    await holdInvite(token);
    redirect("/login?mode=sign-up");
  }

  const { supabase, userId } = caller;

  // THE COOKIE'S ONLY JOB WAS TO SURVIVE SIGN-UP, and they are signed in, so
  // it is finished — whatever happens below. Dropped BEFORE the press is
  // decided, not after it succeeds: a cookie kept through a refusal sits in
  // the browser for half an hour and bounces their NEXT sign-in to a link
  // that is already dead. Nothing is lost by dropping it, because they are
  // holding the token in the form they just posted.
  await releaseHeldInvite();

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await inviteLimitsFromEnv().claimRedemption(ip, floridaToday());
  // Fails open on an Upstash outage — see lib/sesh/invite-limits.ts. Over the
  // limit reads as the same sentence as everything else.
  if (!allowed) return { ok: false, message: INVITE_FAILED };

  const { data, error } = await supabase.rpc("redeem_invite", { p_token_hash: hashInviteToken(token) });
  if (error) return { ok: false, message: readable(error.code) };

  const sesh = String(data ?? "");

  revalidatePath(`/seshes/${sesh}`);
  revalidatePath("/seshes/mine");

  // WHERE THEY LAND DEPENDS ON THEIR CARD, NOT ON THEIR CLAIM. redeem_invite()
  // writes the claim for an unverified or pending member on purpose — that is
  // what makes a link wait across a multi-day review — but private.can_browse
  // still refuses them the sesh. Sending them to /seshes/<id> anyway showed
  // them a 404 for a sesh that is genuinely theirs. This reads the status to
  // pick a screen and decides nothing: the database is still the one refusing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  const status = (profile as { status?: string } | null)?.status;

  // A STATUS WE COULD NOT READ IS NOT EVIDENCE THEY ARE WAITING. The held
  // screen tells somebody their card needs approving, and saying that to a
  // verified member because one self-read hiccuped is a lie on the one
  // screen that has to be plainly true. With nothing to go on, send them to
  // the sesh and let the database answer, the way it did before this branch
  // existed.
  const held = status !== undefined && !canBrowse(status);

  // Throws. Nothing after this runs, and the invite page is never re-rendered
  // with a link that has just been spent.
  redirect(held ? "/invite/held" : `/seshes/${sesh}`);
}
