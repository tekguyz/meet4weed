/** @vitest-environment node
 *
 *  Issue #71 — delete my account. The real delete against the hosted project:
 *  the member's future open seshes are cancelled first, their card and face
 *  images go, the auth user goes, and Claude spend stays on the admin page.
 *
 *  The seshes cascade away with the host, so the cancel is proved on its own
 *  step, then the whole delete is run. Skipped without the service key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelFutureHostedSeshes, deleteMemberAccount } from "@/lib/account/delete";
import { BUCKET, createStore, imagePath } from "@/lib/verification/store";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Delete-probe-3b8e1f6a2c9d!";
const IMAGE_SECRET = Buffer.alloc(32, 7).toString("base64");
const TAMPA = { lat: 27.9506, lng: -82.4572 };
const PROBE_COST = 0.004321;
/** Never a real model id, so the cleanup cannot touch real spend. */
const PROBE_MODEL = "m4w-delete-probe";
/** One Claude call, as recordVision() is handed it. */
const PROBE_CALL = {
  reading: null,
  concerns: [],
  skippedReason: null,
  error: "probe",
  model: PROBE_MODEL,
  inputTokens: 10,
  outputTokens: 5,
  costUsd: PROBE_COST,
};

type Member = { id: string; email: string; db: SupabaseClient };
type Spend = { today_usd: number; month_usd: number; today_calls: number; month_calls: number };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe.skipIf(!configured)("delete my account", () => {
  let service: SupabaseClient;
  let owner: Member;
  const made: string[] = [];

  async function makeMember(tag: string, email = `delete-${tag}-${Date.now()}@meet4weed.test`): Promise<Member> {
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);

    await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: isoDay(200), attested_at: new Date().toISOString() })
      .eq("id", data.user.id);

    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    return { id: data.user.id, email, db };
  }

  /** Written with the service key, so a sesh can start in the past. */
  async function sesh(host: Member, startsAt: string, status: "open" | "cancelled" = "open") {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Delete probe",
        sesh_type: "chill",
        starts_at: startsAt,
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
        status,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`could not create a sesh: ${error?.message}`);
    return data.id as string;
  }

  async function statusOf(id: string) {
    const { data } = await service.from("seshes").select("status").eq("id", id).maybeSingle();
    return (data?.status as string | undefined) ?? null;
  }

  /** What the admin page shows, read the way the admin page reads it. */
  async function spend(): Promise<Spend> {
    const { data, error } = await owner.db.rpc("verification_spend");
    if (error) throw new Error(`verification_spend failed: ${error.code}`);
    const row = (data as Spend[])[0];
    return {
      today_usd: Number(row.today_usd),
      month_usd: Number(row.month_usd),
      today_calls: row.today_calls,
      month_calls: row.month_calls,
    };
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    owner = await makeMember("owner");
    const { error } = await service.from("admins").insert({ user_id: owner.id });
    if (error) throw new Error(`could not make the owner an admin: ${error.message}`);
  }, 60_000);

  afterAll(async () => {
    for (const id of made) await service.auth.admin.deleteUser(id);
    // The ledger outlives every member by design, so the probe calls are
    // taken out by their model name or they would count as real spend.
    await service.from("vision_spend").delete().eq("model", PROBE_MODEL);
  }, 60_000);

  it("cancels only the host's future open seshes", async () => {
    const host = await makeMember("host");
    const other = await makeMember("other");

    const future = await sesh(host, hoursFromNow(48));
    const past = await sesh(host, hoursFromNow(-48));
    const alreadyCancelled = await sesh(host, hoursFromNow(72), "cancelled");
    const someoneElses = await sesh(other, hoursFromNow(48));

    expect(await cancelFutureHostedSeshes(service, host.id)).toBe(1);

    expect(await statusOf(future)).toBe("cancelled");
    expect(await statusOf(past)).toBe("open");
    expect(await statusOf(alreadyCancelled)).toBe("cancelled");
    expect(await statusOf(someoneElses)).toBe("open");
  }, 60_000);

  it("records Claude spend in the ledger, where no member is named", async () => {
    const member = await makeMember("ledger");
    const before = await spend();

    const store = createStore(service, IMAGE_SECRET);
    const begun = await store.begin({ memberId: member.id, patientId: "P000-TEST-0071", cardExpiresOn: "2030-01-01", challenge: "x" });
    if (!begun.ok) throw new Error("could not begin a verification");
    await store.recordVision(begun.id, PROBE_CALL);

    const after = await spend();
    expect(after.month_calls).toBe(before.month_calls + 1);
    expect(after.month_usd).toBeCloseTo(before.month_usd + PROBE_COST, 6);

    // The ledger is service-only. Proved differentially: the same read is
    // refused for a member and answered for service_role.
    const asMember = await member.db.from("vision_spend").select("id").limit(1);
    expect(asMember.error?.code).toBe("42501");
    const asService = await service.from("vision_spend").select("id").limit(1);
    expect(asService.error).toBeNull();
    expect(asService.data).toHaveLength(1);
  }, 60_000);

  it("deletes the member, their images and their future seshes, and keeps the spend", async () => {
    const leaver = await makeMember("leaver");
    const future = await sesh(leaver, hoursFromNow(48));

    const store = createStore(service, IMAGE_SECRET);
    const begun = await store.begin({ memberId: leaver.id, patientId: "P000-TEST-0072", cardExpiresOn: "2030-01-01", challenge: "x" });
    if (!begun.ok) throw new Error("could not begin a verification");
    await store.storeImage({ memberId: leaver.id, verificationId: begun.id, kind: "card", bytes: Buffer.from("synthetic") });
    await store.storeImage({ memberId: leaver.id, verificationId: begun.id, kind: "face_with_card", bytes: Buffer.from("synthetic") });
    await store.recordVision(begun.id, PROBE_CALL);

    const before = await spend();

    await deleteMemberAccount(service, leaver.id);

    const { data: user } = await service.auth.admin.getUserById(leaver.id);
    expect(user.user).toBeNull();
    const { data: profile } = await service.from("profiles").select("id").eq("id", leaver.id).maybeSingle();
    expect(profile).toBeNull();
    expect(await statusOf(future)).toBeNull();

    const { data: objects } = await service.storage.from(BUCKET).list(`${leaver.id}/${begun.id}`);
    expect(objects ?? []).toEqual([]);
    const { data: blob } = await service.storage.from(BUCKET).download(imagePath(leaver.id, begun.id, "card"));
    expect(blob).toBeNull();

    expect(await spend()).toEqual(before);

    // They may come back with the same email, and start again unverified.
    const again = await service.auth.admin.createUser({ email: leaver.email, password: PASSWORD, email_confirm: true });
    expect(again.error).toBeNull();
    made.push(again.data.user!.id);
    const { data: fresh } = await service.from("profiles").select("status").eq("id", again.data.user!.id).single();
    expect(fresh!.status).toBe("unverified");
  }, 90_000);
});
