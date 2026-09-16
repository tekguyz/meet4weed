import { amIAdmin } from "@/lib/admin/queries";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptImage } from "@/lib/verification/image-crypto";
import { BUCKET } from "@/lib/verification/store";

/**
 * Streams one decrypted image to an admin. Storage signed URLs cannot be used:
 * the objects are ciphertext (lib/verification/image-crypto.ts).
 *
 * The document row is read with the admin's own session, so the admin RLS
 * policy — not this file — decides whether the path is visible at all.
 */
export const runtime = "nodejs";

const NOT_FOUND = () => new Response(null, { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (kind !== "card" && kind !== "face_with_card") return NOT_FOUND();
  if (!(await amIAdmin())) return NOT_FOUND();

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("verification_documents")
    .select("storage_path")
    .eq("verification_id", id)
    .eq("kind", kind)
    .maybeSingle();
  if (!doc) return NOT_FOUND();

  const { data: blob, error } = await createAdminClient().storage.from(BUCKET).download(doc.storage_path as string);
  if (error || !blob) return NOT_FOUND();

  const plain = decryptImage(serverEnv().VERIFICATION_SECRET, Buffer.from(await blob.arrayBuffer()));
  return new Response(new Uint8Array(plain), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
