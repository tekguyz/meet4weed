import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { notify } from "@/lib/notify/notify";

/**
 * Turns a fresh anonymous identity into a finished demo visitor (issue #39).
 * Service-role writes only: a member cannot write `status`, `is_demo` or
 * `card_expires_on`, and must not be able to.
 *
 * Walks the same gates /api/dev-login walks — onboarded, a real handle,
 * verified with a card a year ahead — so a visitor never lands on onboarding
 * or a verification screen.
 */

/** The prefix change_handle() reserves, so no real member holds one. */
export const VISITOR_HANDLE_PREFIX = "visitor_";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** `visitor_` and six random lowercase letters. */
export function visitorHandle(): string {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += LETTERS[randomInt(LETTERS.length)];
  return `${VISITOR_HANDLE_PREFIX}${tail}`;
}

const CARD_VALID_DAYS = 365;
const HANDLE_TRIES = 3;
const UNIQUE_VIOLATION = "23505";

export type VisitorResult = { ok: true } | { ok: false; error: string };

export async function prepareVisitor(db: SupabaseClient, userId: string, today: string): Promise<VisitorResult> {
  let saved = false;
  // 26^6 handles; a clash is rare, and a fresh draw settles it.
  for (let i = 0; i < HANDLE_TRIES && !saved; i++) {
    const { error } = await db
      .from("profiles")
      .update({
        is_demo: true,
        status: "verified",
        card_expires_on: addDays(today, CARD_VALID_DAYS),
        attested_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
        handle: visitorHandle(),
        city: "Fort Lauderdale",
        bio: null,
        avatar_seed: randomUUID(),
      })
      .eq("id", userId);
    if (!error) saved = true;
    else if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: `profile: ${error.code}` };
  }
  if (!saved) return { ok: false, error: "profile: no free handle" };

  // The unlock sesh: approved from the first second, so the fuzzy circle
  // resolves to an exact address within a minute of arriving. No unlock row
  // means the cast has not been applied; the visitor still gets in.
  const { data: unlock } = await db
    .from("cast_schedule")
    .select("sesh_id, seshes(host_id)")
    .eq("is_unlock", true)
    .maybeSingle();
  if (!unlock) return { ok: true };

  const seshId = unlock.sesh_id as string;
  const { error: rsvpError } = await db
    .from("rsvps")
    .insert({ sesh_id: seshId, member_id: userId, status: "approved", decided_at: new Date().toISOString() });
  if (rsvpError) return { ok: false, error: `rsvp: ${rsvpError.code}` };

  // The bell shows one real notice: this approval.
  const host = (unlock.seshes as unknown as { host_id: string } | null)?.host_id;
  if (host) await notify(db, { kind: "rsvp_approved", seshId, hostId: host, guestId: userId }, null);

  return { ok: true };
}
