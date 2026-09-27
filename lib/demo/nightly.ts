import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The demo realm's two nightly steps (issue #39). Both ride the daily expiry
 * sweep, which already holds the cron secret check, so there is no new route.
 * Each takes the service-role client, so a test calls it without a request.
 */

/** Moves every cast sesh to its offset from today, in place. Never deletes,
 *  so a visitor's RSVP on a cast sesh survives. Returns how many moved. */
export async function shiftDemoCast(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("shift_demo_cast");
  if (error) throw new Error(`shift_demo_cast failed: ${error.code}`);
  return Number(data ?? 0);
}

/** Deletes every visitor who arrived more than seven days ago, with
 *  everything they own. Selects anonymous identities only, so it can never
 *  reach a real member or the cast. Returns how many went. */
export async function reapDemoVisitors(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("reap_demo_visitors");
  if (error) throw new Error(`reap_demo_visitors failed: ${error.code}`);
  return Number(data ?? 0);
}
