"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteMemberAccount } from "@/lib/account/delete";
import { confirmPassword } from "@/lib/auth/confirm-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { avatarLook, sameLook } from "@/lib/profiles/avatar";
import { handleRefused } from "@/lib/profiles/handle-change";
import { handleSchema, parseTags, profileFieldsSchema } from "@/lib/profiles/schema";
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
  // The same fields show on the member's public profile.
  revalidatePath("/m/[handle]", "page");
  return { ok: true, message: "Profile saved." };
}

/**
 * Settings → Handle (issue #70). The only write is public.change_handle(),
 * which owns the rules: once every 30 days, and never a handle another member
 * gave up in the last 30. UPDATE on handle is revoked from members.
 */
export async function changeHandle(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = handleSchema.safeParse(formData.get("handle") ?? "");
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { handle: parsed.error.issues[0]?.message ?? "Pick another handle." },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const { error } = await supabase.rpc("change_handle", { p_handle: parsed.data });
  if (error) return handleRefused(error);

  // The handle shows in the Frame, on Me, on sesh pages and in profile URLs.
  revalidatePath("/", "layout");
  return { ok: true, message: `Handle changed to @${parsed.data}.` };
}

/**
 * Settings → Avatar (issue #69). Writes a new random seed, and only that
 * column. The form sends the seed on screen, so the new one is picked to look
 * different: a random seed alone gives the same mark about one time in 64.
 * A tampered currentSeed only changes which new mark is picked.
 */
export async function shuffleAvatar(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const raw = formData.get("currentSeed");
  const currentLook = avatarLook(typeof raw === "string" && raw ? raw : null, user.id);

  let seed = crypto.randomUUID();
  // Bounded: each try misses with odds of 1 in 64.
  for (let i = 0; i < 32 && sameLook(avatarLook(seed, user.id), currentLook); i++) {
    seed = crypto.randomUUID();
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_seed: seed })
    .eq("id", user.id);

  if (error) return { ok: false, message: "Could not save that. Try again." };

  // The mark shows in the Frame, on Me and on the public profile.
  revalidatePath("/", "layout");
  return { ok: true, message: "New avatar saved." };
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

/**
 * Settings → Delete account (issue #71). The member types their password, so
 * somebody holding an unlocked phone cannot do it. Then it happens at once,
 * with no grace period: lib/account/delete.ts cancels their future seshes,
 * deletes their card images and deletes the auth user.
 *
 * The member's own session cannot delete an auth user, so the delete runs
 * with the service client, and only for the member this session belongs to.
 */
export async function deleteAccount(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { password: "Type your password to confirm." },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "Sign in again to continue." };

  const check = await confirmPassword(user.email, password);
  if (check === "wrong") {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { password: "That password is not right." },
    };
  }
  if (check === "rate_limited") {
    return { ok: false, message: "Too many tries. Wait a few minutes, then try again." };
  }
  if (check !== "ok") return { ok: false, message: "Could not check your password. Try again." };

  try {
    await deleteMemberAccount(createAdminClient(), user.id);
  } catch (error) {
    console.error(`[delete-account] ${error instanceof Error ? error.message : "failed"}`);
    return { ok: false, message: "Could not delete your account. Try again." };
  }

  // The auth user is gone, so the server may answer 404; the cookies are
  // cleared either way.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
