import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one write that cancels a sesh. A host's Cancel button uses it with the
 * host's own session; deleting an account uses it with the service key for
 * each future sesh the member hosts (issue #71). Both callers then tell the
 * approved guests (#54): cancelSesh in app/(frame)/seshes/actions.ts, and
 * cancelFutureHostedSeshes in lib/account/delete.ts, which reads the guest
 * list before the sesh and its RSVPs cascade away.
 *
 * Only `status` is written, and only ever to cancelled: there is no un-cancel.
 */
export function setSeshCancelled(db: SupabaseClient, seshId: string) {
  return db.from("seshes").update({ status: "cancelled" }).eq("id", seshId);
}
