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
