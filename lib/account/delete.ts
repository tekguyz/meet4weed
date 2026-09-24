import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setSeshCancelled } from "@/lib/sesh/cancel";
import { BUCKET } from "@/lib/verification/store";

/**
 * Deleting a member's account (issue #71). Runs with the service client: the
 * caller has already re-checked the member's password.
 *
 * Three steps, in this order, and a failed step stops the rest, so the member
 * can simply try again:
 *   1. cancel every future open sesh they host, the way a host's Cancel does,
 *      so the guests are told;
 *   2. delete their card and face images;
 *   3. delete the auth user, which cascades the profile and everything on it.
 *
 * Step 2 must finish before step 3. The 7-day reaper finds images through
 * their document rows, and those rows cascade away with the member, so an
 * image left behind by a delete would never be found again.
 *
 * Claude spend is not touched: it lives in public.vision_spend, which names
 * no member.
 */
export async function deleteMemberAccount(db: SupabaseClient, memberId: string): Promise<void> {
  await cancelFutureHostedSeshes(db, memberId);
  await removeMemberImages(db, memberId);

  const { error } = await db.auth.admin.deleteUser(memberId);
  if (error) throw new Error(`deleting the auth user failed: ${error.code ?? error.status}`);
}

/** Returns how many were cancelled. A sesh that has started is history, and a
 *  cancelled one is already final; both go with the cascade untouched. */
export async function cancelFutureHostedSeshes(db: SupabaseClient, hostId: string, now: Date = new Date()): Promise<number> {
  const { data, error } = await db
    .from("seshes")
    .select("id")
    .eq("host_id", hostId)
    .eq("status", "open")
    .gt("starts_at", now.toISOString());
  if (error) throw new Error(`listing hosted seshes failed: ${error.code}`);

  for (const { id } of data ?? []) {
    const { error: cancelError } = await setSeshCancelled(db, id as string);
    if (cancelError) throw new Error(`cancelling a sesh failed: ${cancelError.code}`);
  }
  return data?.length ?? 0;
}

/** Images sit at `<member>/<submission>/<kind>.bin` (lib/verification/store.ts).
 *  Storage lists one folder level at a time, so each submission folder is
 *  listed in turn. Read from Storage, not from the document rows, so an upload
 *  whose row was never written is caught too. */
export async function removeMemberImages(db: SupabaseClient, memberId: string): Promise<number> {
  const bucket = db.storage.from(BUCKET);

  const { data: folders, error } = await bucket.list(memberId, { limit: 1000 });
  if (error) throw new Error("listing the member's images failed");

  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const prefix = `${memberId}/${folder.name}`;
    const { data: files, error: listError } = await bucket.list(prefix, { limit: 1000 });
    if (listError) throw new Error("listing a submission's images failed");
    for (const file of files ?? []) paths.push(`${prefix}/${file.name}`);
  }

  if (paths.length === 0) return 0;
  const { error: removeError } = await bucket.remove(paths);
  if (removeError) throw new Error("deleting the member's images failed");
  return paths.length;
}
