"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAddressBlind, toAuthFailure, type AuthFailure } from "@/lib/auth/auth-errors";
import { emailLinkTarget } from "@/lib/auth/email-redirect";

/**
 * Password reset by emailed LINK. Spec §4.5; copied from tekguyz-squid-ink
 * (c8ceb09).
 *
 * 1. `requestPasswordReset` — Supabase mails a link to app/auth/confirm.
 * 2. The button on that page verifies it (email-link.ts), which SIGNS THE
 *    ACCOUNT IN — Supabase has no "verified but not signed in" state — and
 *    sends it to /login/new-password.
 * 3. `setNewPassword` — `updateUser` on that session.
 *
 * A member can stop after step 2 and is signed in without changing the
 * password. That is the same trust as the link itself — whoever reads the
 * inbox — and not a new way in.
 */

const Request = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });
const NewPassword = z.object({ password: z.string().min(1).max(72) });

type Result = { ok: true } | { ok: false; failure: AuthFailure };

/** `{ ok: true }` whether or not an account exists, so the form cannot be used
 *  to find out who is a member. Per-address failures are logged, not shown. */
export async function requestPasswordReset(input: z.input<typeof Request>): Promise<Result> {
  const parsed = Request.safeParse(input);
  if (!parsed.success) return { ok: false, failure: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await emailLinkTarget(),
  });
  if (!error) return { ok: true };

  const failure = toAuthFailure(error);
  if (isAddressBlind(failure)) return { ok: false, failure };
  console.error(`[auth] hidden from the form to keep membership private: ${failure}`);
  return { ok: true };
}

export async function setNewPassword(input: z.input<typeof NewPassword>): Promise<Result> {
  const parsed = NewPassword.safeParse(input);
  if (!parsed.success) return { ok: false, failure: "invalid_input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, failure: "no_session" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, failure: toAuthFailure(error) };

  redirect("/");
}
