import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import { hashInviteToken, verifyInviteToken } from "@/lib/sesh/invite-token";

/**
 * Reading invites. Two readers, and neither of them spends anything.
 *
 * Kept out of lib/sesh/queries.ts on purpose: this module reads the server
 * secret through lib/sesh/invite-token.ts, and queries.ts is imported for its
 * TYPES by client components. A type import is erased, but a module that
 * holds the key should not be one line away from a file the browser's
 * dependency graph already touches.
 */

export type InvitePreview = { title: string; startsAt: string };

/**
 * What a GET on an invite link renders: the sesh TITLE and START TIME, and
 * nothing else. Not the area name, not the fuzzy circle, not the host's
 * handle, not even the sesh id. Just enough for a human to know what they are
 * being let into before they press.
 *
 * IT SPENDS NOTHING. Every chat app fetches a pasted link to draw a preview
 * card, and one use is the default, so a link that spent itself on that fetch
 * would be dead before the recipient ever saw it. app/auth/confirm/page.tsx
 * already solves this for emailed auth links and carries the same note.
 *
 * Null for a bad tag, an expired link, a used-up one, a revoked one and one
 * that never existed. The caller renders ONE sentence for all of them.
 *
 * The tag is checked FIRST, which is the whole point of having one: garbage
 * is thrown out without a database round trip, so guessing costs an attacker
 * everything and costs this app nothing.
 */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!verifyInviteToken(serverEnv().VERIFICATION_SECRET, token)) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_token_hash: hashInviteToken(token) });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return null;

  return { title: row.title as string, startsAt: row.starts_at as string };
}

export type InviteRow = {
  id: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
  /** Not revoked, not expired, uses remaining. The host reads this as "this
   *  one still works". */
  live: boolean;
  /** How many people walked through it. */
  claimCount: number;
  /** How many of those the host has not seen in the queue yet. Rendered as
   *  "claimed, not yet able to join" and NOTHING else — see below. */
  waitingCount: number;
};

/**
 * The host's invite panel.
 *
 * THE CLAIMANT'S VERIFICATION STATUS IS NOT IN THIS PAYLOAD, and cannot be:
 * nothing here reads `profiles`. `waitingCount` is derived from one fact the
 * host already has — whether that person turns up in the sesh's own RSVP list
 * — so a claim is either somebody the host is already looking at in the
 * queue, or a number with a sentence next to it.
 *
 * One derived state, several possible causes: not verified yet, waiting on
 * card review, card expired, or simply has not pressed "ask to come". The
 * host needs none of them, and handing over even the first three would be
 * handing over a piece of somebody's verification record.
 *
 * NO TOKEN COMES BACK EITHER. `authenticated` holds no SELECT grant on
 * `invites.token_hash`, so naming it here would fail the whole query with
 * 42501 — the panel cannot rebuild a link even by accident.
 */
export async function listSeshInvites(seshId: string): Promise<InviteRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("invites")
    .select("id, expires_at, max_uses, use_count, revoked_at, created_at")
    .eq("sesh_id", seshId)
    .order("created_at", { ascending: false });

  const invites = (data ?? []) as Record<string, unknown>[];
  if (!invites.length) return [];

  const { data: claimRows } = await supabase
    .from("invite_claims")
    .select("invite_id, member_id")
    .eq("sesh_id", seshId);

  const { data: rsvpRows } = await supabase.from("rsvps").select("member_id").eq("sesh_id", seshId);

  const inQueue = new Set((rsvpRows ?? []).map((r) => (r as Record<string, unknown>).member_id as string));

  const claims = new Map<string, { total: number; waiting: number }>();
  for (const row of (claimRows ?? []) as Record<string, unknown>[]) {
    const key = row.invite_id as string;
    const seen = claims.get(key) ?? { total: 0, waiting: 0 };
    seen.total += 1;
    if (!inQueue.has(row.member_id as string)) seen.waiting += 1;
    claims.set(key, seen);
  }

  const now = Date.now();

  return invites.map((row) => {
    const counted = claims.get(row.id as string) ?? { total: 0, waiting: 0 };
    const maxUses = row.max_uses as number;
    const useCount = row.use_count as number;
    const expiresAt = row.expires_at as string;
    const revokedAt = (row.revoked_at as string | null) ?? null;

    return {
      id: row.id as string,
      expiresAt,
      maxUses,
      useCount,
      revokedAt,
      live: revokedAt === null && new Date(expiresAt).getTime() > now && useCount < maxUses,
      claimCount: counted.total,
      waitingCount: counted.waiting,
    };
  });
}
