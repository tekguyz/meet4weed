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
