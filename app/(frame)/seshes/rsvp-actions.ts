"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify/notify";
import { readMyRsvpStatus, readSeshFacts } from "@/lib/notify/sesh-facts";
import { floridaToday } from "@/lib/dates";
import { memberLimitsFromEnv } from "@/lib/sesh/member-limits";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * Asking to come, withdrawing, and the host deciding.
 *
 * Every rule lives in Postgres — see supabase/migrations/…_rsvps.sql. The
 * main job here is to turn a SQLSTATE into a sentence. A raw `M4W14` on
 * screen is a bug, not an error message, so the fallback is deliberately a
 * plain apology rather than anything the database said.
 *
 * The other job is telling people: once the database has accepted a change,
 * the action writes the notification it earns (lib/notify).
 */

const seshId = z.uuid();
const rsvpId = z.uuid();
const DECISIONS = ["approved", "denied", "kicked"] as const;
const decision = z.enum(DECISIONS);

const MESSAGES: Record<string, string> = {
  M4W10: "Your card is not current. Renew it and you can join seshes again.",
  M4W11: "That sesh is not taking requests any more.",
  M4W12: "You are hosting this one.",
  M4W13: "The host removed you from this sesh, so you cannot ask again.",
  M4W14: "That sesh just filled up.",
  M4W17: "You have asked to join twenty seshes today. Try again tomorrow.",
};

/** Our own limit, not the database's — see lib/sesh/member-limits.ts. */
const TOO_MANY_PRESSES = "You have asked to join a lot of seshes today. Try again tomorrow.";

const FALLBACK = "Could not do that just now. Try again.";

function readable(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}

async function callerOrNull() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function askToJoin(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const sesh = seshId.safeParse(formData.get("seshId"));
  if (!sesh.success) return { ok: false, message: "Could not find that sesh." };

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };
  const { supabase, user } = caller;

  // Counted before the database is asked, and refused whole: nothing is
  // written. Fails open on an Upstash outage — the database's own cap of 20
  // new requests a day still holds.
  if (!(await memberLimitsFromEnv().claimRsvp(user.id, floridaToday()))) {
    return { ok: false, message: TOO_MANY_PRESSES };
  }

  // Read through the member's own session: a sesh they can ask to join is
  // one they can see. request_rsvp accepts asking again while already
  // waiting, so the old status says whether the host has news.
  const [facts, wasStatus] = await Promise.all([
    readSeshFacts(supabase, sesh.data),
    readMyRsvpStatus(supabase, sesh.data, user.id),
  ]);

  const { error } = await supabase.rpc("request_rsvp", { p_sesh: sesh.data });
  if (error) return { ok: false, message: readable(error.code) };

  if (facts && wasStatus !== "requested") {
    await notify(createAdminClient(), { kind: "rsvp_requested", seshId: sesh.data, hostId: facts.hostId, guestId: user.id });
  }

  revalidatePath(`/seshes/${sesh.data}`);
  revalidatePath("/seshes/mine");
  return { ok: true, message: "Asked to join. The host will let you know." };
}

export async function withdrawRsvp(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const sesh = seshId.safeParse(formData.get("seshId"));
  if (!sesh.success) return { ok: false, message: "Could not find that sesh." };

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };
  const { supabase } = caller;

  const { error } = await supabase.rpc("cancel_rsvp", { p_sesh: sesh.data });
  if (error) return { ok: false, message: readable(error.code) };

  revalidatePath(`/seshes/${sesh.data}`);
  revalidatePath("/seshes/mine");
  return { ok: true, message: "Withdrawn." };
}

export async function decideRsvp(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const rsvp = rsvpId.safeParse(formData.get("rsvpId"));
  // A decision arrives from a form, so it arrives from anybody. Checked here
  // as well as in the database, so a typo never reaches Postgres as an enum
  // cast failure a member would see as a 500.
  const choice = decision.safeParse(formData.get("decision"));
  if (!rsvp.success || !choice.success) return { ok: false, message: "Could not do that." };

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };
  const { supabase, user } = caller;

  // Read before deciding, through the host's own session: a host sees every
  // RSVP on their sesh. The guest and the sesh come from the row, never from
  // the form, and the old status says whether a decision is news —
  // decide_rsvp accepts deciding the same way twice. Removing a guest tells
  // nobody: the guest sees it on the sesh, and it is not one of the seven.
  const before =
    choice.data === "kicked"
      ? null
      : (await supabase.from("rsvps").select("member_id, sesh_id, status").eq("id", rsvp.data).single()).data;

  const { error } = await supabase.rpc("decide_rsvp", { p_rsvp: rsvp.data, p_decision: choice.data });
  if (error) return { ok: false, message: readable(error.code) };

  if (before && before.status !== choice.data) {
    const seshOfRsvp = before.sesh_id as string;
    const guestId = before.member_id as string;
    if (choice.data === "approved") {
      await notify(createAdminClient(), { kind: "rsvp_approved", seshId: seshOfRsvp, hostId: user.id, guestId });
    } else {
      // A denied guest can no longer see the sesh, so its title rides in the
      // row (#52). The host reads it here. The denial has happened either
      // way, so an unread title still sends the notice.
      const facts = await readSeshFacts(supabase, seshOfRsvp);
      await notify(createAdminClient(), {
        kind: "rsvp_denied",
        seshId: seshOfRsvp,
        hostId: user.id,
        guestId,
        seshTitle: facts?.title ?? null,
      });
    }
  }

  const sesh = seshId.safeParse(formData.get("seshId"));
  if (sesh.success) revalidatePath(`/seshes/${sesh.data}`);
  revalidatePath("/seshes/mine");

  return {
    ok: true,
    message:
      choice.data === "approved" ? "Approved." : choice.data === "denied" ? "Declined." : "Removed from the sesh.",
  };
}
