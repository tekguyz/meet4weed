import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/verification/store";

/**
 * Deletes Storage objects first, then their rows. If Storage refuses, the rows
 * stay, so the daily reaper finds and retries them — a row is never deleted
 * while its object might still exist.
 */
export async function removeDocuments(db: SupabaseClient, docs: { id: string; storage_path: string }[]): Promise<number> {
  if (docs.length === 0) return 0;

  const { error: storageError } = await db.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
  if (storageError) {
    console.error("[reaper] Storage refused a delete; the rows stay for the next run");
    return 0;
  }

  const { error } = await db.from("verification_documents").delete().in("id", docs.map((d) => d.id));
  if (error) console.error(`[reaper] objects deleted but rows remain: ${error.code}`);
  return docs.length;
}

/**
 * Spec §4.2: any image older than 7 days is deleted unconditionally, and any
 * image whose submission was decided is deleted if the decision's own delete
 * did not finish. An unreviewed submission whose images are gone is lapsed, so
 * the member is asked to capture again.
 */
export async function runReaper(db: SupabaseClient, now: Date = new Date()): Promise<{ removed: number; lapsed: number }> {
  type Doc = { id: string; storage_path: string; verification_id: string; verifications: { status: string } };

  const [expired, decided] = await Promise.all([
    db
      .from("verification_documents")
      .select("id, storage_path, verification_id, verifications!inner(status)")
      .lt("expires_at", now.toISOString()),
    db
      .from("verification_documents")
      .select("id, storage_path, verification_id, verifications!inner(status)")
      .neq("verifications.status", "pending_review"),
  ]);
  if (expired.error || decided.error) throw new Error("reaper could not list documents");

  const byId = new Map<string, Doc>();
  for (const doc of [...(expired.data ?? []), ...(decided.data ?? [])] as unknown as Doc[]) byId.set(doc.id, doc);
  const docs = [...byId.values()];

  const stale = new Set(
    ((expired.data ?? []) as unknown as Doc[])
      .filter((d) => d.verifications.status === "pending_review")
      .map((d) => d.verification_id),
  );

  const removed = await removeDocuments(db, docs);

  let lapsed = 0;
  for (const id of stale) {
    const { error } = await db.rpc("lapse_verification", { p_id: id });
    if (error) console.error(`[reaper] lapse failed: ${error.code}`);
    else lapsed += 1;
  }
  return { removed, lapsed };
}
