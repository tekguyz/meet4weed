/** @vitest-environment node
 *
 *  THE file. Spec §6.1 asks for it by name.
 *
 *  A sesh happens at somebody's home. Everything below is the difference
 *  between an app that keeps that address and an app that publishes it, and
 *  all of it is decided in Postgres — no screen, no server action, and no
 *  client is consulted.
 *
 *  Every security claim is proved DIFFERENTIALLY: the same statement on the
 *  same row fails for a member and succeeds for service_role. No live rule is
 *  weakened anywhere to make a test go red.
 *
 *  Run by hand before merging anything that touches a migration, and say
 *  whether it RAN — the vitest summary line hides a skip.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";
const INSUFFICIENT_PRIVILEGE = "42501";
const TAMPA = { lat: 27.9506, lng: -82.4572 };

const STREET = "1 Test Street";
const UNIT = "Apt 4";
const GATE = "1234";

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe.skipIf(!configured)("the address unlock", () => {
  let service: SupabaseClient;
  let host: Member;
  let approved: Member;
  let requester: Member;
  let denied: Member;
  let removed: Member;
  let withdrawn: Member;
  let stranger: Member;
  let admin: Member;
  const created: string[] = [];

  async function makeMember(tag: string, status: "verified" | "expired" = "verified"): Promise<Member> {
    const email = `unlock-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    await service
      .from("profiles")
      .update({
        status,
        card_expires_on: status === "verified" ? isoDay(200) : isoDay(-10),
        attested_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);
    return { id: data.user.id, db };
  }

  async function makeSesh(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Test sesh",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 10,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: STREET,
        unit_note: UNIT,
        gate_code: GATE,
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    created.push(data!.id as string);
    return data!.id as string;
  }

  const ask = (as: Member, sesh: string) => as.db.rpc("request_rsvp", { p_sesh: sesh });
  const withdraw = (as: Member, sesh: string) => as.db.rpc("cancel_rsvp", { p_sesh: sesh });

  async function decide(sesh: string, member: Member, decision: string) {
    const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh).eq("member_id", member.id).single();
    const { error } = await host.db.rpc("decide_rsvp", { p_rsvp: data!.id, p_decision: decision });
    if (error) throw new Error(`decide failed: ${error.message}`);
  }

  /** The only legitimate way to read an address. An empty array is the locked
   *  state — not an error, and not something a screen decides. */
  const addressFor = async (as: Member, sesh: string) => (await as.db.rpc("sesh_address", { p_sesh: sesh })).data;

  /** A sesh with one approved guest, ready to poke at. */
  async function seshWithGuest(overrides: Record<string, unknown> = {}): Promise<string> {
    const sesh = await makeSesh();
    await ask(approved, sesh);
    await decide(sesh, approved, "approved");
    if (Object.keys(overrides).length) await service.from("seshes").update(overrides).eq("id", sesh);
    return sesh;
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host");
    approved = await makeMember("approved");
    requester = await makeMember("requester");
    denied = await makeMember("denied");
    removed = await makeMember("removed");
    withdrawn = await makeMember("withdrawn");
    stranger = await makeMember("stranger");
    admin = await makeMember("admin");
    const { error } = await service.from("admins").insert({ user_id: admin.id });
    if (error) throw new Error(`could not make an admin: ${error.message}`);
  }, 180_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    if (admin?.id) await service.from("admins").delete().eq("user_id", admin.id);
    for (const m of [host, approved, requester, denied, removed, withdrawn, stranger, admin]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 180_000);

  describe("who gets the address", () => {
    it("gives it to an approved guest, in full", async () => {
      const sesh = await seshWithGuest();

      const data = await addressFor(approved, sesh);

      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ address_line: STREET, unit_note: UNIT, gate_code: GATE });
      expect(data![0].exact_lat).toBeCloseTo(TAMPA.lat, 4);
    });

    it("gives it to the host", async () => {
      const sesh = await makeSesh();

      expect(await addressFor(host, sesh)).toHaveLength(1);
    });

    it("refuses somebody who has only asked", async () => {
      const sesh = await makeSesh();
      await ask(requester, sesh);

      expect(await addressFor(requester, sesh)).toEqual([]);
    });

    it("refuses somebody who was declined", async () => {
      const sesh = await makeSesh();
      await ask(denied, sesh);
      await decide(sesh, denied, "denied");

      expect(await addressFor(denied, sesh)).toEqual([]);
    });

    it("takes it back from somebody the host removes", async () => {
      const sesh = await makeSesh();
      await ask(removed, sesh);
      await decide(sesh, removed, "approved");
      expect(await addressFor(removed, sesh)).toHaveLength(1);

      await decide(sesh, removed, "kicked");

      expect(await addressFor(removed, sesh)).toEqual([]);
    });

    it("takes it back from somebody who withdraws", async () => {
      const sesh = await makeSesh();
      await ask(withdrawn, sesh);
      await decide(sesh, withdrawn, "approved");
      expect(await addressFor(withdrawn, sesh)).toHaveLength(1);

      await withdraw(withdrawn, sesh);

      expect(await addressFor(withdrawn, sesh)).toEqual([]);
    });

    it("refuses a stranger who never asked", async () => {
      const sesh = await seshWithGuest();

      expect(await addressFor(stranger, sesh)).toEqual([]);
    });

    /** Verification is the gate AFTER approval as well as before it. */
    it("takes it back from an approved guest whose card lapses", async () => {
      const sesh = await seshWithGuest();
      expect(await addressFor(approved, sesh)).toHaveLength(1);

      await service.from("profiles").update({ card_expires_on: isoDay(-3) }).eq("id", approved.id);
      const whileLapsed = await addressFor(approved, sesh);
      await service.from("profiles").update({ card_expires_on: isoDay(200) }).eq("id", approved.id);

      expect(whileLapsed).toEqual([]);
      expect(await addressFor(approved, sesh)).toHaveLength(1);
    });

    /** There is no admin branch in the rule, on purpose. If safety reports in
     *  step 10 need one it arrives then, with an audit row per read. */
    it("refuses the app's own admin", async () => {
      const sesh = await seshWithGuest();

      expect(await addressFor(admin, sesh)).toEqual([]);
    });
  });

  describe("when the address goes away again", () => {
    it("locks the moment the host cancels", async () => {
      const sesh = await seshWithGuest();
      expect(await addressFor(approved, sesh)).toHaveLength(1);

      await service.from("seshes").update({ status: "cancelled" }).eq("id", sesh);

      expect(await addressFor(approved, sesh)).toEqual([]);
    });

    it("locks twelve hours after the sesh starts", async () => {
      const sesh = await makeSesh();
      await ask(approved, sesh);
      await decide(sesh, approved, "approved");

      await service.from("seshes").update({ starts_at: hoursFromNow(-11) }).eq("id", sesh);
      const elevenHoursIn = await addressFor(approved, sesh);

      await service.from("seshes").update({ starts_at: hoursFromNow(-13) }).eq("id", sesh);
      const thirteenHoursIn = await addressFor(approved, sesh);

      expect(elevenHoursIn).toHaveLength(1);
      expect(thirteenHoursIn).toEqual([]);
    });

    /** The host keeps reading their own address through both of those, or
     *  they are locked out of their own edit screen. */
    it("never locks the host out of their own", async () => {
      const cancelled = await makeSesh({ status: "cancelled" });
      const longOver = await makeSesh({ starts_at: hoursFromNow(-200) });

      expect(await addressFor(host, cancelled)).toHaveLength(1);
      expect(await addressFor(host, longOver)).toHaveLength(1);
    });
  });

  describe("the table itself", () => {
    /** The function is the ONLY way in. Even an approved guest cannot name a
     *  private column in an ordinary query — a privilege is checked before
     *  any policy, so no policy bug can open this. */
    it("refuses the private columns to an approved guest, and gives them to service_role", async () => {
      const sesh = await seshWithGuest();

      const asGuest = await approved.db.from("seshes").select("address_line").eq("id", sesh);
      const asService = await service.from("seshes").select("address_line").eq("id", sesh);

      expect(asGuest.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.data![0].address_line).toBe(STREET);
    });

    it("refuses the exact point to an approved guest, and gives them the circle", async () => {
      const sesh = await seshWithGuest();

      const exact = await approved.db.from("seshes").select("exact_lat").eq("id", sesh);
      const fuzzy = await approved.db.from("seshes").select("fuzzy_lat, fuzzy_radius_m").eq("id", sesh).single();

      expect(exact.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(fuzzy.data!.fuzzy_lat).not.toBeNull();
      expect(fuzzy.data!.fuzzy_radius_m).toBe(400);
    });

    it("fails a wildcard outright rather than quietly trimming it", async () => {
      const sesh = await seshWithGuest();

      const asGuest = await approved.db.from("seshes").select("*").eq("id", sesh);

      expect(asGuest.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  describe("a cancelled sesh stays visible to the people who needed to know", () => {
    it("is still readable by an approved guest, marked cancelled", async () => {
      const sesh = await seshWithGuest({ status: "cancelled" });

      const { data } = await approved.db.from("seshes").select("id, status").eq("id", sesh).maybeSingle();

      expect(data).toEqual({ id: sesh, status: "cancelled" });
    });

    it("is still readable by somebody who had only asked", async () => {
      const sesh = await makeSesh();
      await ask(requester, sesh);
      await service.from("seshes").update({ status: "cancelled" }).eq("id", sesh);

      const { data } = await requester.db.from("seshes").select("id").eq("id", sesh);

      expect(data).toHaveLength(1);
    });

    it("has vanished for everybody else", async () => {
      const sesh = await seshWithGuest({ status: "cancelled" });

      const { data } = await stranger.db.from("seshes").select("id").eq("id", sesh);

      expect(data).toEqual([]);
    });

    it("keeps an approved guest able to see an expired host's sesh too", async () => {
      const sesh = await seshWithGuest();
      await service.from("profiles").update({ card_expires_on: isoDay(-3) }).eq("id", host.id);

      const toGuest = await approved.db.from("seshes").select("id").eq("id", sesh);
      const toStranger = await stranger.db.from("seshes").select("id").eq("id", sesh);

      await service.from("profiles").update({ card_expires_on: isoDay(200) }).eq("id", host.id);
      expect(toGuest.data).toHaveLength(1);
      expect(toStranger.data).toEqual([]);
    });
  });
});
