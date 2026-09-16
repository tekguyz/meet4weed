/** @vitest-environment node
 *
 *  Who can read a submission, who can decide one, and who can call the
 *  service-only functions — tested through PostgREST with real members, the
 *  same way as profiles-rls.test.ts. Skipped without the service key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

// Must satisfy the hosted password rule: lower, upper, digit, symbol.
const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";

type Member = { id: string; db: SupabaseClient };

/** A UTC calendar day. Offsets are kept at least 2 days from today wherever
 *  the Florida day matters, so a run in the evening (UTC already tomorrow)
 *  cannot flip a result. */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!configured)("verification row-level security", () => {
  let service: SupabaseClient;
  let member: Member;
  let owner: Member;
  let pendingId: string;

  async function makeMember(tag: string): Promise<Member> {
    const email = `rls-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    await service.from("profiles").update({ attested_at: new Date().toISOString() }).eq("id", data.user.id);
    return { id: data.user.id, db };
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    member = await makeMember("member");
    owner = await makeMember("owner");
    const { error } = await service.from("admins").insert({ user_id: owner.id });
    if (error) throw new Error(`could not make owner an admin: ${error.message}`);

    const { data, error: beginError } = await service.rpc("begin_verification", {
      p_member_id: member.id,
      p_patient_id: "P000-TEST-0001",
      p_card_expires_on: isoDay(200),
      p_challenge: "Hold up two fingers",
    });
    if (beginError) throw new Error(`begin_verification failed: ${beginError.message}`);
    pendingId = data as string;
  }, 60_000);

  afterAll(async () => {
    for (const m of [member, owner]) if (m?.id) await service.auth.admin.deleteUser(m.id);
  }, 60_000);

  describe("begin_verification", () => {
    it("moves an unverified member to pending_review and remembers where they were", async () => {
      const { data } = await service.from("verifications").select("status, previous_status").eq("id", pendingId).single();
      expect(data).toEqual({ status: "pending_review", previous_status: "unverified" });
      const { data: profile } = await service.from("profiles").select("status").eq("id", member.id).single();
      expect(profile!.status).toBe("pending_review");
    });

    it("refuses a second pending submission", async () => {
      const { error } = await service.rpc("begin_verification", {
        p_member_id: member.id, p_patient_id: "P000-TEST-0001", p_card_expires_on: isoDay(200), p_challenge: "x",
      });
      expect(error?.code).toBe("M4W02");
    });

    it("refuses a card that has already expired", async () => {
      const { error } = await service.rpc("begin_verification", {
        p_member_id: owner.id, p_patient_id: "P000-TEST-0002", p_card_expires_on: isoDay(-3), p_challenge: "x",
      });
      expect(error?.code).toBe("M4W04");
    });

    it("cannot be called by a member", async () => {
      const { error } = await member.db.rpc("begin_verification", {
        p_member_id: member.id, p_patient_id: "P", p_card_expires_on: isoDay(200), p_challenge: "x",
      });
      expect(error?.code).toBe("42501");
    });
  });

  describe("what a member can see", () => {
    it("reads no verification rows, not even their own", async () => {
      const { data, error } = await member.db.from("verifications").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("reads their own status through my_verification_status, without Claude's concerns", async () => {
      const { data, error } = await member.db.rpc("my_verification_status");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(Object.keys(data![0]).sort()).toEqual(["created_at", "decided_at", "decision_reason", "status"]);
    });

    it("cannot read document rows", async () => {
      const { data } = await member.db.from("verification_documents").select("id");
      expect(data ?? []).toEqual([]);
    });

    it("cannot write a verification", async () => {
      const { error } = await member.db.from("verifications").update({ status: "approved" }).eq("id", pendingId);
      expect(error?.code).toBe("42501");
    });

    it("cannot make themselves an admin", async () => {
      const { error } = await member.db.from("admins").insert({ user_id: member.id });
      expect(error?.code).toBe("42501");
    });

    it("cannot reach the private schema through the API", async () => {
      const { error } = await member.db.rpc("is_admin");
      expect(error).not.toBeNull();
    });

    it("cannot read the image bucket", async () => {
      const path = `${member.id}/probe.bin`;
      const upload = await service.storage.from("verification-images").upload(path, new Blob(["x"]), { upsert: true });
      expect(upload.error).toBeNull();
      const { data, error } = await member.db.storage.from("verification-images").download(path);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      await service.storage.from("verification-images").remove([path]);
    });

    it("cannot run the expiry sweep or lapse a submission", async () => {
      const sweep = await member.db.rpc("expiry_sweep", { p_today: isoDay(0) });
      const lapse = await member.db.rpc("lapse_verification", { p_id: pendingId });
      expect(sweep.error?.code).toBe("42501");
      expect(lapse.error?.code).toBe("42501");
    });
  });

  describe("admin", () => {
    it("am_i_admin tells the two apart", async () => {
      expect((await member.db.rpc("am_i_admin")).data).toBe(false);
      expect((await owner.db.rpc("am_i_admin")).data).toBe(true);
    });

    it("a member cannot decide", async () => {
      const { error } = await member.db.rpc("decide_verification", {
        p_id: pendingId, p_decision: "approve", p_reason: null, p_card_expires_on: isoDay(200),
      });
      expect(error?.code).toBe("42501");
    });

    it("an admin sees the pending submission", async () => {
      const { data } = await owner.db.from("verifications").select("id, patient_id, status").eq("id", pendingId);
      expect(data).toEqual([{ id: pendingId, patient_id: "P000-TEST-0001", status: "pending_review" }]);
    });

    it("an admin cannot approve with an expiry in the past", async () => {
      const { error } = await owner.db.rpc("decide_verification", {
        p_id: pendingId, p_decision: "approve", p_reason: null, p_card_expires_on: isoDay(-3),
      });
      expect(error?.code).toBe("22023");
    });

    it("an admin cannot reject without a reason", async () => {
      const { error } = await owner.db.rpc("decide_verification", {
        p_id: pendingId, p_decision: "reject", p_reason: "  ", p_card_expires_on: null,
      });
      expect(error?.code).toBe("22023");
    });

    it("approval verifies the member, records the reviewer and writes the audit row", async () => {
      const expires = isoDay(200);
      const { error } = await owner.db.rpc("decide_verification", {
        p_id: pendingId, p_decision: "approve", p_reason: null, p_card_expires_on: expires,
      });
      expect(error).toBeNull();

      const { data: profile } = await service.from("profiles").select("status, card_expires_on").eq("id", member.id).single();
      expect(profile).toEqual({ status: "verified", card_expires_on: expires });

      const { data: v } = await service.from("verifications").select("status, decided_by").eq("id", pendingId).single();
      expect(v).toEqual({ status: "approved", decided_by: owner.id });

      const { data: audit } = await owner.db.from("admin_actions").select("action, actor_id").eq("verification_id", pendingId);
      expect(audit).toEqual([{ action: "verification_approved", actor_id: owner.id }]);

      expect((await member.db.rpc("am_i_active_member")).data).toBe(true);
    });

    it("a decided submission cannot be decided again", async () => {
      const { error } = await owner.db.rpc("decide_verification", {
        p_id: pendingId, p_decision: "reject", p_reason: "second thoughts", p_card_expires_on: null,
      });
      expect(error?.code).toBe("M4W05");
    });

    it("spend is visible to an admin and refused to a member", async () => {
      expect((await owner.db.rpc("verification_spend")).error).toBeNull();
      expect((await member.db.rpc("verification_spend")).error?.code).toBe("42501");
    });
  });

  describe("expiry_sweep", () => {
    it("expires a lapsed card, lists recent expiries, and lists each only until noticed", async () => {
      await service.from("profiles").update({ status: "verified", card_expires_on: isoDay(-3) }).eq("id", member.id);
      await service.from("profiles").update({ status: "verified", card_expires_on: isoDay(0) }).eq("id", owner.id);

      const { data, error } = await service.rpc("expiry_sweep", { p_today: isoDay(0) });
      expect(error).toBeNull();

      const { data: expired } = await service.from("profiles").select("status").eq("id", member.id).single();
      expect(expired!.status).toBe("expired");
      expect((await member.db.rpc("am_i_active_member")).data).toBe(false);

      const ids = (data as { member_id: string }[]).map((r) => r.member_id);
      expect(ids).toEqual(expect.arrayContaining([member.id, owner.id]));

      await service.from("expiry_notices").insert({ member_id: owner.id, card_expires_on: isoDay(0) });
      const again = await service.rpc("expiry_sweep", { p_today: isoDay(0) });
      expect((again.data as { member_id: string }[]).map((r) => r.member_id)).not.toContain(owner.id);
    });
  });
});
