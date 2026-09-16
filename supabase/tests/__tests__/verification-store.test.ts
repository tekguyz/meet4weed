/** @vitest-environment node
 *
 *  The real store against the hosted project: what lands in Storage is
 *  ciphertext, and the document rows point at it. Skipped without the key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decryptImage } from "@/lib/verification/image-crypto";
import { BUCKET, createStore, imagePath } from "@/lib/verification/store";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && SECRET);
const IMAGE_SECRET = Buffer.alloc(32, 9).toString("base64");

describe.skipIf(!configured)("verification store (hosted)", () => {
  let db: SupabaseClient;
  let memberId: string;

  beforeAll(async () => {
    db = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await db.auth.admin.createUser({
      email: `store-${Date.now()}@meet4weed.test`,
      password: "Store-probe-4c1d9e7a!",
      email_confirm: true,
    });
    memberId = data.user!.id;
    await db.from("profiles").update({ attested_at: new Date().toISOString() }).eq("id", memberId);
  }, 60_000);

  afterAll(async () => {
    if (memberId) await db.auth.admin.deleteUser(memberId);
  }, 60_000);

  it("stores ciphertext, records the document, and maps a second begin to already_pending", async () => {
    const store = createStore(db, IMAGE_SECRET);
    const plain = Buffer.from("synthetic image bytes");

    const begun = await store.begin({ memberId, patientId: "P000-TEST-0001", cardExpiresOn: "2030-01-01", challenge: "x" });
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;

    await store.storeImage({ memberId, verificationId: begun.id, kind: "card", bytes: plain });

    const { data: blob } = await db.storage.from(BUCKET).download(imagePath(memberId, begun.id, "card"));
    const stored = Buffer.from(await blob!.arrayBuffer());
    expect(stored.includes(plain)).toBe(false);
    expect(decryptImage(IMAGE_SECRET, stored).equals(plain)).toBe(true);

    const { data: docs } = await db.from("verification_documents").select("kind, byte_size").eq("verification_id", begun.id);
    expect(docs).toEqual([{ kind: "card", byte_size: stored.length }]);

    expect(await store.begin({ memberId, patientId: "P", cardExpiresOn: "2030-01-01", challenge: "x" })).toEqual({
      ok: false,
      code: "already_pending",
    });

    await store.lapse(begun.id);
    const { data: profile } = await db.from("profiles").select("status").eq("id", memberId).single();
    expect(profile!.status).toBe("unverified");

    await db.storage.from(BUCKET).remove([imagePath(memberId, begun.id, "card")]);
  }, 60_000);
});
