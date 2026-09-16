import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server-env";

/** Service-role client. Bypasses every row policy — use it only after the
 *  caller's right to act has been established, and never for a read a
 *  member's own session could do. */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
