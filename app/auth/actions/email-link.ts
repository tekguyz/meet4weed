"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { heldInvitePath } from "@/lib/sesh/held-invite";

/**
 * Verifies an emailed confirmation or password-reset link — the POST behind
 * app/auth/confirm's button. Spec §4.5; copied from tekguyz-squid-ink (c8ceb09).
 *
 * A POST, not the GET that opens the page. A mail scanner that fetches every
 * link in a message issues the GET; it does not submit forms. Verifying on the
 * GET would let the scanner spend the one-time token before the person taps.
 * The cost is one extra tap.
 *
 * `token_hash`, not `?code=`. The templates (supabase/templates/) build the
 * link from `{{ .TokenHash }}`, so verifying needs no PKCE verifier cookie, and
 * a link opened in a different browser from the one that asked for it still
 * works — which matters on iOS, where Mail opens Safari, not the installed app.
 *
 * Only two link types exist in this app. A magic-link `type` is refused:
 * magic-link sign-in is retired.
 */

const DESTINATION = {
  // app/(frame)/layout.tsx sends an account without attestation on to /onboarding.
  email: "/",
  recovery: "/login/new-password",
} as const;

export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  if (typeof tokenHash !== "string" || !tokenHash || (type !== "email" && type !== "recovery")) {
    redirect("/login?error=link_invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    console.error(`[auth] link verification failed: ${error.code ?? "(no code)"}`);
    redirect("/login?error=link_invalid");
  }
  // A LINK THAT WAITED THROUGH SIGN-UP. Somebody pressed an invite button
  // with no account; the token went into a short-lived cookie and they were
  // sent here to make one. Put them back on that invite page so they can
  // press it again — the second press is what spends the use. This redirect
  // spends nothing; see app/(frame)/seshes/invite-actions.ts.
  //
  // Confirmation only. A password reset is not a sign-up and must land on
  // the new-password screen.
  if (type === "email") {
    const held = await heldInvitePath();
    if (held) redirect(held);
  }

  redirect(DESTINATION[type]);
}
