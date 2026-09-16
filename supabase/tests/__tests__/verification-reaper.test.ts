/** @vitest-environment node
 *
 *  The 7-day promise (spec §4.2), against the real bucket: an unreviewed
 *  submission's photos are deleted and the member is asked to capture again;
 *  a decided submission's leftover photos are deleted too. Skipped without
 *  the key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runReaper } from "@/lib/verification/reaper";
import { BUCKET, createStore, imagePath } from "@/lib/verification/store";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const IMAGE_SECRET = Buffer.alloc(32, 4).toString("base64");

describe.skipIf(!(URL && SECRET))("verification reaper (hosted)", () => {
  let db: SupabaseClient;
  const members: string[] = [];

  async function submission() {
    const { data } = await db.auth.admin.createUser({
      email: `reaper-${Date.now()}-${members.length}@meet4weed.test`,
      password: "Reaper-probe-7e2b4f1c!",
      email_confirm: true,
    });
    const memberId = data.user!.id;
    members.push(memberId);
    await db.from("profiles").update({ attested_at: new Date().toISOString() }).eq("id", memberId);
    const store = createStore(db, IMAGE_SECRET);
    const begun = await store.begin({ memberId, patientId: "P000-TEST-0001", cardExpiresOn: "2030-01-01", challenge: "x" });
    if (!begun.ok) throw new Error(begun.code);
    await store.storeImage({ memberId, verificationId: begun.id, kind: "card", bytes: Buffer.from("a") });
    await store.storeImage({ memberId, verificationId: begun.id, kind: "face_with_card", bytes: Buffer.from("b") });
    return { memberId, id: begun.id };
  }

  const exists = async (path: string) => !(await db.storage.from(BUCKET).download(path)).error;

  beforeAll(() => {
    db = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    for (const id of members) await db.auth.admin.deleteUser(id);
  }, 60_000);

  it("deletes week-old photos of an unreviewed submission and lapses it", async () => {
    const { memberId, id } = await submission();
    await db.from("verification_documents").update({ expires_at: "2000-01-01T00:00:00Z" }).eq("verification_id", id);

    const result = await runReaper(db);

    expect(result.lapsed).toBeGreaterThanOrEqual(1);
    expect(await exists(imagePath(memberId, id, "card"))).toBe(false);
    expect(await exists(imagePath(memberId, id, "face_with_card"))).toBe(false);
    const { data: docs } = await db.from("verification_documents").select("id").eq("verification_id", id);
    expect(docs).toEqual([]);
    const { data: v } = await db.from("verifications").select("status").eq("id", id).single();
    expect(v!.status).toBe("lapsed");
    const { data: p } = await db.from("profiles").select("status").eq("id", memberId).single();
    expect(p!.status).toBe("unverified");
  }, 60_000);

  it("deletes fresh photos left behind by a decided submission, and leaves a pending one alone", async () => {
    const decided = await submission();
    const waiting = await submission();
    await db.from("verifications").update({ status: "rejected" }).eq("id", decided.id);

    await runReaper(db);

    expect(await exists(imagePath(decided.memberId, decided.id, "card"))).toBe(false);
    expect(await exists(imagePath(waiting.memberId, waiting.id, "card"))).toBe(true);
    await db.storage.from(BUCKET).remove([
      imagePath(waiting.memberId, waiting.id, "card"),
      imagePath(waiting.memberId, waiting.id, "face_with_card"),
    ]);
  }, 60_000);
});
