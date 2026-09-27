"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { floridaToday } from "@/lib/dates";
import { doorVerdict } from "@/lib/demo/door";
import { demoLimitsFromEnv } from "@/lib/demo/limits";
import { prepareVisitor } from "@/lib/demo/visitor";
import type { ActionState } from "@/lib/forms/action-state";
import { demoModeEnabled } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The demo door (issue #39). Both buttons — the landing page and /login —
 * post here. It is a server action, so only a button press reaches it: a link
 * preview, a prefetch or a crawler sends a GET and creates nothing.
 *
 * DEMO-STANDARD rule 2: somebody already signed in is left signed in as
 * themselves and sent home. A real session is never replaced.
 */
export async function enterDemo(_prev: ActionState | null, _form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const enabled = demoModeEnabled();
  // Counted only when the door could open, so a closed demo spends nothing.
  const claim = enabled
    ? await demoLimitsFromEnv().claimVisitor(await clientIp(), new Date())
    : { ipAllowed: true, globalAllowed: true };
  const verdict = doorVerdict({ enabled, ...claim });
  if (!verdict.open) return { ok: false, message: verdict.message };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error(`[demo] anonymous sign-in failed: ${error?.code ?? "no user"}`);
    return { ok: false, message: FAILED };
  }

  const prepared = await prepareVisitor(createAdminClient(), data.user.id, floridaToday());
  if (!prepared.ok) {
    console.error(`[demo] visitor not prepared: ${prepared.error}`);
    // Half a visitor is worse than none: they would land on onboarding. The
    // identity is anonymous, so the 7-day cleanup takes it.
    await supabase.auth.signOut();
    return { ok: false, message: FAILED };
  }

  redirect("/seshes");
}

const FAILED = "The demo did not open. Try again in a minute.";

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** "Leave demo" in the banner. Signs the visitor out and returns them to the
 *  landing page. The anonymous identity has no password, so the visit cannot
 *  be reopened; the 7-day cleanup deletes it. A POST, like every sign-out. */
export async function leaveDemo(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
