"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileInputSchema } from "@/lib/profiles/schema";
import type { ActionState } from "@/lib/forms/action-state";

const checked = z.literal("on");

/** All four must be true. They are separate boxes rather than one "I agree"
 *  because the record of WHICH claim a member made is the point — a single
 *  blanket checkbox proves nothing about age or the no-sales rule. */
const attestationSchema = z.object({
  age: checked,
  resident: checked,
  card: checked,
  noSales: checked,
});

export async function recordAttestation(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = attestationSchema.safeParse({
    age: formData.get("age"),
    resident: formData.get("resident"),
    card: formData.get("card"),
    noSales: formData.get("noSales"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Tick every box to continue." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const { error } = await supabase
    .from("profiles")
    .update({ attested_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, message: "Could not save that. Try again." };

  revalidatePath("/onboarding");
  return { ok: true, message: "" };
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function saveProfile(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileInputSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName") || undefined,
    bio: formData.get("bio") || undefined,
    city: formData.get("city") || undefined,
    strainPrefs: formData.getAll("strainPrefs"),
    methodPrefs: formData.getAll("methodPrefs"),
    vibeTags: parseTags(formData.get("vibeTags")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  // Only the columns `authenticated` holds an UPDATE grant on. Naming a column
  // the member cannot write — status, card_expires_on — makes Postgres reject
  // the whole statement with 42501, even when the value is unchanged.
  const { error } = await supabase
    .from("profiles")
    .update({
      handle: parsed.data.handle,
      display_name: parsed.data.displayName ?? null,
      bio: parsed.data.bio ?? null,
      city: parsed.data.city ?? null,
      strain_prefs: parsed.data.strainPrefs,
      method_prefs: parsed.data.methodPrefs,
      vibe_tags: parsed.data.vibeTags,
    })
    .eq("id", user.id);

  // 23505 is the unique violation on profiles_handle_key. Surfacing the raw
  // Postgres message here would print the index name to a member.
  if (error?.code === "23505") {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { handle: "That handle is taken. Try another." },
    };
  }
  if (error) return { ok: false, message: "Could not save that. Try again." };

  revalidatePath("/");

  // Onboarding's last step. Returning a "Saved." string leaves the member
  // staring at the form they just completed with no way forward, so the
  // action ends the flow itself. redirect() throws, so nothing runs after it.
  redirect("/");
}
