"use server";

import { serverEnv } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";
import { issueChallenge } from "@/lib/verification/challenge-token";

/** Called when the member reaches the face step, not before: the challenge is
 *  chosen at capture time so nobody can prepare a photo for it (spec §4.1). */
export async function issueFaceChallenge(): Promise<{ ok: true; challenge: string; token: string } | { ok: false }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  return { ok: true, ...issueChallenge(serverEnv().VERIFICATION_SECRET, user.id) };
}
