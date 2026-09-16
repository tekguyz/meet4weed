"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export type MagicLinkState = { ok: boolean; message: string };

const SENT = "Check your email. The link works once and expires in an hour.";

export async function requestMagicLink(
  _prevState: MagicLinkState | null,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: "That does not look like an email address." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  // Deliberately identical on success and failure. Distinguishing them turns
  // this form into a membership oracle: "is this person in the weed app?"
  // Real failures are Sentry's problem, not the visitor's.
  if (error) return { ok: true, message: SENT };

  return { ok: true, message: SENT };
}
