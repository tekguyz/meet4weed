import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationsFor, type NotifyEvent } from "@/lib/notify/events";

/**
 * Writes the rows an event produces. Takes the admin client: a member has no
 * INSERT on public.notifications, so only service_role can write one.
 *
 * Call it only after the thing it reports has happened. It never throws — the
 * approval (or whatever it was) is already done, and a failed notice must not
 * turn that into an error on the member's screen.
 */
export async function notify(db: SupabaseClient, event: NotifyEvent): Promise<void> {
  const rows = notificationsFor(event);
  if (rows.length === 0) return;

  const { error } = await db.from("notifications").insert(rows);
  if (error) console.error(`[notify] ${event.kind} not recorded: ${error.code}`);
}

/** The unique index the clock-driven rows collide on (#55). */
const ONCE = "recipient_id,type,dedup_key";

/**
 * Writes clock-driven rows at most once each, and returns how many were new.
 * The cron job may run twice; each row carries a dedup_key, and the unique
 * index turns a repeat into ON CONFLICT DO NOTHING. Code that checks first
 * races. The database does not.
 *
 * Unlike notify(), a failed write throws. Nothing a member did is waiting on
 * it, and a cron run that quietly reports 0 would read exactly like a clean
 * second run.
 */
export async function notifyOnce(db: SupabaseClient, events: readonly NotifyEvent[]): Promise<number> {
  const rows = events.flatMap(notificationsFor);
  if (rows.length === 0) return 0;

  const { data, error } = await db
    .from("notifications")
    .upsert(rows, { onConflict: ONCE, ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`clock notifications not recorded: ${error.code}`);
  return data?.length ?? 0;
}
