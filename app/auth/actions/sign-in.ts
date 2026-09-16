"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toAuthFailure, type AuthFailure } from "@/lib/auth/auth-errors";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Email + password sign-in. Sends no email. Spec §4.5; copied from
 * tekguyz-squid-ink (c8ceb09).
 *
 * There is no second way in: `signInWithOtp` is gone, app/auth/confirm verifies
 * only confirmation and reset links, and
 * lib/auth/__tests__/magic-link-retired.test.ts fails if a magic link comes back.
 *
 * An unconfirmed account gets `email_not_confirmed` back, not a session — the
 * hosted confirm-email gate refuses it. Supabase returns that code only when
 * the password is right, so it reveals nothing to someone who does not already
 * hold the password.
 *
 * Squid Ink's "Keep me signed in" was not copied. Meet4Weed runs as an
 * installed PWA; a session cookie that dies when the app is swiped away would
 * sign the member out every time.
 */

const SignIn = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // 72: bcrypt reads no further, and Supabase refuses longer rather than
  // silently truncating.
  password: z.string().min(1).max(72),
  next: z.string().optional(),
});

export type SignInInput = z.input<typeof SignIn>;

export async function signInWithPassword(input: SignInInput): Promise<{ failure: AuthFailure }> {
  const parsed = SignIn.safeParse(input);
  if (!parsed.success) return { failure: "invalid_input" };
  const { email, password, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { failure: toAuthFailure(error) };

  redirect(safeNext(next));
}
