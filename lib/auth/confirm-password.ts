import "server-only";
import { createClient } from "@supabase/supabase-js";
import { toAuthFailure } from "@/lib/auth/auth-errors";

export type PasswordCheck = "ok" | "wrong" | "rate_limited" | "unknown";

/**
 * Is this the member's password? Asked before a delete (issue #71), so
 * somebody holding an unlocked phone cannot delete the account.
 *
 * A throwaway client with no storage, so the check never touches the member's
 * own session cookies. The session the check makes is signed out at once;
 * `local` scope, because `global` would sign the member out everywhere.
 */
export async function confirmPassword(email: string, password: string): Promise<PasswordCheck> {
  const checker = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (!error) {
    await checker.auth.signOut({ scope: "local" });
    return "ok";
  }

  const failure = toAuthFailure(error);
  if (failure === "invalid_credentials") return "wrong";
  if (failure === "rate_limited") return "rate_limited";
  return "unknown";
}
