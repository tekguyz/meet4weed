"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms/action-state";
import { CONTRIBUTIONS_PER_MEMBER, contributionInputSchema } from "@/lib/sesh/on-deck";

/**
 * Adding to the on-deck list and taking something off it.
 *
 * Every rule lives in Postgres — see supabase/migrations/…_contributions.sql.
 * Who may write, what shape a row takes, the cap, the label limit, and the
 * fact that "bringing none" and a list of things cannot both be true: all of
 * it is decided there. The only job here is to turn a SQLSTATE into a
 * sentence. A raw `M4W18` on screen is a bug, not an error message, so the
 * fallback is a plain apology rather than anything the database said.
 *
 * Writes send ONLY the granted columns. Per CLAUDE.md an UPDATE that names a
 * non-granted column fails whole with 42501 even when the value does not
 * change, so `kind`, `sesh_id` and `member_id` appear on the insert and
 * nowhere else.
 */

const seshId = z.uuid();
const contributionId = z.uuid();

const MESSAGES: Record<string, string> = {
  M4W18: `You can list ${CONTRIBUTIONS_PER_MEMBER} things for one sesh. Take one off to add another.`,
  // A unique violation is one of two things, and both read the same way to
  // the person: they already said this.
  "23505": "You already put that down.",
  "23514": "That does not look right. Check the name and try again.",
  "42501": "You cannot change the on-deck list for this sesh.",
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

export async function addContribution(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const sesh = seshId.safeParse(formData.get("seshId"));
  if (!sesh.success) return { ok: false, message: "Could not find that sesh." };

  const parsed = contributionInputSchema.safeParse({
    kind: formData.get("kind"),
    label: formData.get("label") ?? undefined,
    strainType: formData.get("strainType") ?? undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Check what you typed." };
  }

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };

  const input = parsed.data;
  const { error } = await caller.supabase.from("contributions").insert({
    sesh_id: sesh.data,
    member_id: caller.userId,
    kind: input.kind,
    label: input.kind === "none" ? null : input.label,
    strain_type: input.kind === "strain" ? input.strainType : null,
  });
  if (error) return { ok: false, message: readable(error.code) };

  revalidatePath(`/seshes/${sesh.data}`);
  return {
    ok: true,
    message: input.kind === "none" ? "Noted — bringing none." : "Added to the on-deck list.",
  };
}

export async function removeContribution(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const sesh = seshId.safeParse(formData.get("seshId"));
  const id = contributionId.safeParse(formData.get("contributionId"));
  if (!sesh.success || !id.success) return { ok: false, message: "Could not find that." };

  const caller = await callerOrNull();
  if (!caller) return { ok: false, message: "Sign in again to continue." };

  // A delete the policy refuses removes no rows and raises nothing, so the
  // returned rows are the only honest signal that anything happened.
  const { data, error } = await caller.supabase
    .from("contributions")
    .delete()
    .eq("id", id.data)
    .eq("sesh_id", sesh.data)
    .select("id");
  if (error) return { ok: false, message: readable(error.code) };
  if (!data?.length) return { ok: false, message: MESSAGES["42501"] };

  revalidatePath(`/seshes/${sesh.data}`);
  return { ok: true, message: "Taken off the list." };
}
