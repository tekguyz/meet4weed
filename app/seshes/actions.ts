"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { floridaWallClockToInstant } from "@/lib/dates";
import { seshInputSchema } from "@/lib/sesh/schema";
import type { ActionState } from "@/lib/forms/action-state";

/** Postgres answers a column-privilege refusal and a row-policy refusal with
 *  the same code, and a member can act on neither. One message covers both
 *  reasons a host's own insert can bounce. */
const INSUFFICIENT_PRIVILEGE = "42501";
const REFUSED =
  "Could not post that sesh. Check your card is still current, and that you do not already have five open seshes.";

function optional(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function createSesh(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = seshInputSchema.safeParse({
    title: formData.get("title"),
    description: optional(formData.get("description")),
    seshType: formData.get("seshType"),
    startsAtLocal: formData.get("startsAtLocal"),
    capacity: formData.get("capacity"),
    exactLat: formData.get("exactLat"),
    exactLng: formData.get("exactLng"),
    addressLine: formData.get("addressLine"),
    unitNote: optional(formData.get("unitNote")),
    gateCode: optional(formData.get("gateCode")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  // The column accepts any instant, so a past start time is refused here
  // rather than by a CHECK — a constraint would make every later edit of a
  // finished sesh fail, including the 7-day address wipe.
  const startsAt = floridaWallClockToInstant(parsed.data.startsAtLocal);
  if (!startsAt) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { startsAtLocal: "Pick a date and time." },
    };
  }
  if (startsAt.getTime() <= Date.now()) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { startsAtLocal: "Pick a time in the future." },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  // Only the columns `authenticated` holds an INSERT grant on. Naming a
  // column a host cannot write — status, or either fuzzy column — makes
  // Postgres reject the whole statement with 42501, even when the value would
  // have been the default. The circle is the trigger's job, not ours.
  const { error } = await supabase
    .from("seshes")
    .insert({
      host_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sesh_type: parsed.data.seshType,
      starts_at: startsAt.toISOString(),
      capacity: parsed.data.capacity,
      exact_lat: parsed.data.exactLat,
      exact_lng: parsed.data.exactLng,
      address_line: parsed.data.addressLine,
      unit_note: parsed.data.unitNote ?? null,
      gate_code: parsed.data.gateCode ?? null,
    })
    .select("id")
    .single();

  if (error?.code === INSUFFICIENT_PRIVILEGE) return { ok: false, message: REFUSED };
  if (error) return { ok: false, message: "Could not save that. Try again." };

  revalidatePath("/seshes/mine");

  // redirect() throws to unwind the request, so nothing runs after it.
  redirect("/seshes/mine");
}
