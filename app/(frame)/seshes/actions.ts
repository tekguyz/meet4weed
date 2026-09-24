"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { floridaToday, floridaWallClockToInstant } from "@/lib/dates";
import { areaNameLookup } from "@/lib/sesh/area-name";
import { setSeshCancelled } from "@/lib/sesh/cancel";
import { memberLimitsFromEnv } from "@/lib/sesh/member-limits";
import { seshInputSchema } from "@/lib/sesh/schema";
import type { ActionState } from "@/lib/forms/action-state";

/** Postgres answers a column-privilege refusal and a row-policy refusal with
 *  the same code, and a member can act on neither. One message covers both
 *  reasons a host's own write can bounce. */
const INSUFFICIENT_PRIVILEGE = "42501";
/** Raised by seshes_guard_capacity. It gets its own code so this screen can
 *  say how many people are already in; an RLS refusal would arrive as 42501,
 *  indistinguishable from every other reason a write can bounce. */
const CAPACITY_BELOW_APPROVED = "M4W16";
const REFUSED =
  "Could not post that sesh. Check your card is still current, and that you do not already have five open seshes.";
const CHECK_FIELDS = "Check the highlighted fields.";
/** Our own limit, not the database's — see lib/sesh/member-limits.ts. */
const TOO_MANY_POSTS = "You have posted a lot of seshes today. Try again tomorrow.";

const seshId = z.uuid();

function optional(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function readForm(formData: FormData) {
  return seshInputSchema.safeParse({
    title: formData.get("title"),
    description: optional(formData.get("description")),
    seshType: formData.get("seshType"),
    // optional(), not get(): a missing field must arrive as undefined so the
    // schema's default can take it. formData.get() returns null, which a
    // zod default does not fill in.
    visibility: optional(formData.get("visibility")),
    startsAtLocal: formData.get("startsAtLocal"),
    capacity: formData.get("capacity"),
    exactLat: formData.get("exactLat"),
    exactLng: formData.get("exactLng"),
    addressLine: formData.get("addressLine"),
    unitNote: optional(formData.get("unitNote")),
    gateCode: optional(formData.get("gateCode")),
    areaName: optional(formData.get("areaName")),
  });
}

/** The column accepts any instant, so a past start time is refused here rather
 *  than by a CHECK — a constraint would make every later edit of a finished
 *  sesh fail, including the 7-day address wipe. */
function futureInstant(local: string): { at: Date } | { error: ActionState } {
  const startsAtLocal = (message: string) => ({
    error: { ok: false as const, message: CHECK_FIELDS, fieldErrors: { startsAtLocal: message } },
  });

  const at = floridaWallClockToInstant(local);
  if (!at) return startsAtLocal("Pick a date and time.");
  if (at.getTime() <= Date.now()) return startsAtLocal("Pick a time in the future.");
  return { at };
}

/** Never throws, and never blocks a save. A member hosting must not depend on
 *  a third party being up. */
async function lookUpAreaName(fuzzyLat: unknown, fuzzyLng: unknown): Promise<string | null> {
  if (typeof fuzzyLat !== "number" || typeof fuzzyLng !== "number") return null;
  try {
    return await areaNameLookup()({ lat: fuzzyLat, lng: fuzzyLng });
  } catch {
    return null;
  }
}

export async function createSesh(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = readForm(formData);
  if (!parsed.success) {
    return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const when = futureInstant(parsed.data.startsAtLocal);
  if ("error" in when) return when.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  // Counted once the form is sound, and refused whole: nothing is written.
  // Fails open on an Upstash outage — the five-open-seshes policy still holds.
  if (!(await memberLimitsFromEnv().claimSeshCreate(user.id, floridaToday()))) {
    return { ok: false, message: TOO_MANY_POSTS };
  }

  // Only the columns `authenticated` holds an INSERT grant on. Naming a
  // column a host cannot write — status, area_name, or either fuzzy column —
  // makes Postgres reject the whole statement with 42501, even when the value
  // would have been the default. The circle is the trigger's job, not ours.
  const { data, error } = await supabase
    .from("seshes")
    .insert({
      host_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sesh_type: parsed.data.seshType,
      visibility: parsed.data.visibility,
      starts_at: when.at.toISOString(),
      capacity: parsed.data.capacity,
      exact_lat: parsed.data.exactLat,
      exact_lng: parsed.data.exactLng,
      address_line: parsed.data.addressLine,
      unit_note: parsed.data.unitNote ?? null,
      gate_code: parsed.data.gateCode ?? null,
    })
    .select("id, fuzzy_lat, fuzzy_lng")
    .single();

  if (error?.code === INSUFFICIENT_PRIVILEGE) return { ok: false, message: REFUSED };
  if (error || !data) return { ok: false, message: "Could not save that. Try again." };

  // Two round trips, on purpose: the fuzzy point does not exist until the row
  // does, because a trigger works it out. The lookup is then handed the
  // CIRCLE, never the address — that is the only reason an outside call is
  // acceptable anywhere in this feature.
  const areaName = parsed.data.areaName ?? (await lookUpAreaName(data.fuzzy_lat, data.fuzzy_lng));
  if (areaName) await supabase.from("seshes").update({ area_name: areaName }).eq("id", data.id as string);

  revalidatePath("/seshes/mine");

  // redirect() throws to unwind the request, so nothing runs after it.
  redirect("/seshes/mine");
}

export async function editSesh(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const id = seshId.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Could not find that sesh." };

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const when = futureInstant(parsed.data.startsAtLocal);
  if ("error" in when) return when.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  // `status` is deliberately absent. Cancelling is its own act with its own
  // consequences — it locks the address at once — so it never rides along in
  // an ordinary edit.
  const { error } = await supabase
    .from("seshes")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sesh_type: parsed.data.seshType,
      visibility: parsed.data.visibility,
      starts_at: when.at.toISOString(),
      capacity: parsed.data.capacity,
      exact_lat: parsed.data.exactLat,
      exact_lng: parsed.data.exactLng,
      address_line: parsed.data.addressLine,
      unit_note: parsed.data.unitNote ?? null,
      gate_code: parsed.data.gateCode ?? null,
      area_name: parsed.data.areaName ?? null,
    })
    .eq("id", id.data);

  if (error?.code === CAPACITY_BELOW_APPROVED) {
    // Only on the failure path, so the happy path stays one round trip.
    const { data: sesh } = await supabase
      .from("seshes")
      .select("approved_count")
      .eq("id", id.data)
      .single();
    const approved = (sesh?.approved_count as number | undefined) ?? 0;
    return {
      ok: false,
      message: CHECK_FIELDS,
      fieldErrors: {
        capacity: `You have ${approved} ${approved === 1 ? "person" : "people"} approved. Remove somebody first, or keep room for them.`,
      },
    };
  }
  if (error?.code === INSUFFICIENT_PRIVILEGE) return { ok: false, message: REFUSED };
  if (error) return { ok: false, message: "Could not save that. Try again." };

  revalidatePath("/seshes/mine");
  redirect("/seshes/mine");
}

/** There is no un-cancel, here or anywhere. Cancelling locks the address at
 *  once, and handing it back to a guest list that has already moved on is the
 *  thing this whole plan exists to stop. */
export async function cancelSesh(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const id = seshId.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Could not find that sesh." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const { error } = await setSeshCancelled(supabase, id.data);
  if (error) return { ok: false, message: "Could not cancel that. Try again." };

  revalidatePath("/seshes/mine");
  redirect("/seshes/mine");
}
