"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAddressBlind, toAuthFailure, type AuthFailure } from "@/lib/auth/auth-errors";
import { emailLinkTarget } from "@/lib/auth/email-redirect";

/**
 * Sign-up with email + password, confirmed by an emailed LINK. Spec §4.5;
 * copied from tekguyz-squid-ink (c8ceb09).
 *
 * Until the link is used the confirm-email gate refuses a password sign-in
 * (`email_not_confirmed`). The link lands on app/auth/confirm, which verifies
 * it only when a person presses the button — never on the GET a mail scanner
 * sends.
 *
 * The same answer for a known and an unknown address. Supabase already
 * returns an obfuscated user and mails nothing for an existing account; the
 * failures it can still raise per address are logged and answered as success
 * (lib/auth/auth-errors.ts § isAddressBlind).
 */

const Email = z.string().trim().toLowerCase().pipe(z.email());
const SignUp = z.object({ email: Email, password: z.string().min(1).max(72) });
const Resend = z.object({ email: Email });

type Result = { ok: true } | { ok: false; failure: AuthFailure };

function blind(error: { code?: string; message?: string }): Result {
  const failure = toAuthFailure(error);
  if (isAddressBlind(failure)) return { ok: false, failure };
  console.error(`[auth] hidden from the form to keep membership private: ${failure}`);
  return { ok: true };
}

export async function signUpWithPassword(input: z.input<typeof SignUp>): Promise<Result> {
  const parsed = SignUp.safeParse(input);
  if (!parsed.success) return { ok: false, failure: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await emailLinkTarget() },
  });
  if (error) return blind(error);

  // A session here means the hosted confirm-email gate is OFF — config drift,
  // not a feature. Refuse it rather than let an unconfirmed account in.
  if (data.session) {
    console.error("[auth] signUp returned a session: the confirm-email gate is off");
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, failure: "unknown" };
  }

  return { ok: true };
}

/** For an account that tried to sign in before confirming. Each resend is an
 *  email against the project's send limit, so the screen should not invite
 *  repeated presses. */
export async function resendConfirmationLink(input: z.input<typeof Resend>): Promise<Result> {
  const parsed = Resend.safeParse(input);
  if (!parsed.success) return { ok: false, failure: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await emailLinkTarget() },
  });
  return error ? blind(error) : { ok: true };
}
