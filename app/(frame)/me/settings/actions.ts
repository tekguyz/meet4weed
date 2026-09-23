"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseTags, profileFieldsSchema } from "@/lib/profiles/schema";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * Settings → Edit profile (issue #65). Onboarding's saveProfile without the
 * handle, and without the redirect: the member stays on the form and the
 * shared banner says it saved.
 */
export async function updateProfile(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileFieldsSchema.safeParse({
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

  // Only columns `authenticated` holds an UPDATE grant on, built from the
  // parsed data and never from the form. Naming status or card_expires_on
  // makes Postgres reject the whole statement with 42501.
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName ?? null,
      bio: parsed.data.bio ?? null,
      city: parsed.data.city ?? null,
      strain_prefs: parsed.data.strainPrefs,
      method_prefs: parsed.data.methodPrefs,
      vibe_tags: parsed.data.vibeTags,
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: "Could not save that. Try again." };

  revalidatePath("/me", "layout");
  return { ok: true, message: "Profile saved." };
}

/**
 * Settings → Sessions. Supabase Auth's global scope revokes every refresh
 * token the account holds, so a lost phone is signed out the next time its
 * access token runs out. Plain sign-out stays the POST to /auth/sign-out.
 */
export async function signOutEverywhere(_prevState: ActionState | null): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { ok: false, message: "Could not sign out everywhere. Try again." };
  redirect("/login");
}
