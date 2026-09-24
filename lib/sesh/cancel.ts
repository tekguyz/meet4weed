import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one write that cancels a sesh. A host's Cancel button uses it with the
 * host's own session; deleting an account uses it with the service key for
 * each future sesh the member hosts (issue #71). Plan 05's cancel notification
 * hangs here, so both paths tell the guests.
 *
 * For Plan 05: on the delete path the sesh and its RSVPs cascade away a moment
 * after this call. The notification must collect its guest list here, before
 * this returns, and must not rely on `auth.uid()` — the delete path runs with
 * the service key.
 *
 * Only `status` is written, and only ever to cancelled: there is no un-cancel.
 */
export function setSeshCancelled(db: SupabaseClient, seshId: string) {
  return db.from("seshes").update({ status: "cancelled" }).eq("id", seshId);
}
