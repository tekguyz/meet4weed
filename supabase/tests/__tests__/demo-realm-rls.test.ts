/** @vitest-environment node
 *
 *  Issue #39 — the demo realm's walls.
 *
 *  Three claims, each proved against the real project through PostgREST with
 *  each caller's own session:
 *
 *    1. The real realm and the demo realm cannot see each other, either way —
 *       seshes, profiles, RSVPs, and the exact location by every route.
 *    2. A visitor sees the cast and their own rows, never another visitor's.
 *    3. Nothing a visitor does changes what the next visitor sees: the seat
 *       count holds, and no notification is written to a cast member.
 *
 *  Visitors are made with a REAL anonymous sign-in, so the `is_anonymous`
 *  path is what is tested, not a simulation of it. That needs anonymous
 *  sign-ins turned on in the project.
 *
 *  Every refusal is proved DIFFERENTIALLY: the same statement on the same row
 *  fails for the caller and succeeds for service_role (or for the member the
 *  rule is meant to let through). No live rule is weakened to make a test red.
 *
 *  Skipped without SUPABASE_SECRET_KEY, so CI never runs it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Realm-probe-6c1e9a4f2b8d!";
const NOT_TAKING_REQUESTS = "M4W11";
const NOT_IN_THE_DEMO = "M4W40";

const FORT_LAUDERDALE = { lat: 26.1224, lng: -80.1373 };
const MARKER = `realmprobe${Date.now()}`;

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

/** The columns lib/sesh/queries.ts lists. Never `select *`. */
const LIST = "id, host_id, title, status, is_demo, approved_count";

const session = () =>
  createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!configured)("the demo realm", () => {
  let service: SupabaseClient;
  const made: string[] = [];

  let realHost: Member;
  let realGuest: Member;
  let castHost: Member;
  let castGuest: Member;
  let visitor: Member;
  let otherVisitor: Member;
  let stray: Member;

  let realSesh: string;
  let castSesh: string;
  let otherVisitorSesh: string;
  let realToken: string;

  async function verify(id: string, patch: Record<string, unknown> = {}) {
    const { error } = await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: isoDay(200), attested_at: new Date().toISOString(), ...patch })
      .eq("id", id);
    if (error) throw new Error(`could not verify: ${error.message}`);
  }

  async function makeReal(tag: string): Promise<Member> {
    const email = `realm-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);
    const db = session();
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    await verify(data.user.id);
    return { id: data.user.id, db };
  }

  /** A cast member. The real cast has no password and cannot sign in; this
   *  one gets a session only so the test can check what a cast host would
   *  see, which it never needs to. It is not anonymous, which is what makes
   *  it cast rather than visitor. */
  async function makeCast(tag: string): Promise<Member> {
    const member = await makeReal(`cast-${tag}`);
    await verify(member.id, { is_demo: true });
    return member;
  }

  /** A visitor, made the way the demo door makes one: an anonymous sign-in,
   *  then the server turns it into a verified demo member. */
  async function makeVisitor(demo = true): Promise<Member> {
    const db = session();
    const { data, error } = await db.auth.signInAnonymously();
    if (error || !data.user) throw new Error(`anonymous sign-in failed (is it on in the project?): ${error?.message}`);
    made.push(data.user.id);
    if (demo) await verify(data.user.id, { is_demo: true });
    return { id: data.user.id, db };
  }

  async function insertSesh(as: Member, overrides: Record<string, unknown> = {}) {
    return as.db
      .from("seshes")
      .insert({
        host_id: as.id,
        title: `Probe ${MARKER}`,
        description: `A sesh tagged ${MARKER}`,
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: FORT_LAUDERDALE.lat,
        exact_lng: FORT_LAUDERDALE.lng,
        address_line: "1 Probe Street",
        gate_code: "1234",
        ...overrides,
      })
      .select("id")
      .single();
  }

  async function mustInsertSesh(as: Member, overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await insertSesh(as, overrides);
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    return data!.id as string;
  }

  /** Setup through service_role: an approved RSVP, the way the cast file and
   *  the demo door write one. */
  async function approvedRsvp(sesh: string, member: string) {
    const { error } = await service.from("rsvps").insert({ sesh_id: sesh, member_id: member, status: "approved" });
    if (error) throw new Error(`rsvp insert failed: ${error.message}`);
  }

  const countOf = async (sesh: string) =>
    (await service.from("seshes").select("approved_count").eq("id", sesh).single()).data!.approved_count as number;

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });

    realHost = await makeReal("host");
    realGuest = await makeReal("guest");
    castHost = await makeCast("host");
    castGuest = await makeCast("guest");
    visitor = await makeVisitor();
    otherVisitor = await makeVisitor();
    stray = await makeVisitor(false);

    realSesh = await mustInsertSesh(realHost);
    await approvedRsvp(realSesh, realGuest.id);

    castSesh = await mustInsertSesh(castHost);
    await approvedRsvp(castSesh, castGuest.id);
    const { error: castBringError } = await castGuest.db
      .from("contributions")
      .insert({ sesh_id: castSesh, member_id: castGuest.id, kind: "item", label: "Chips" });
    if (castBringError) throw new Error(`cast contribution failed: ${castBringError.message}`);

    otherVisitorSesh = await mustInsertSesh(otherVisitor);
    await approvedRsvp(castSesh, otherVisitor.id);
    const { error: otherBringError } = await otherVisitor.db
      .from("contributions")
      .insert({ sesh_id: castSesh, member_id: otherVisitor.id, kind: "item", label: "Other visitor's ice" });
    if (otherBringError) throw new Error(`visitor contribution failed: ${otherBringError.message}`);

    realToken = randomBytes(24).toString("base64url");
    const { error: mintError } = await realHost.db.rpc("mint_invite", {
      p_sesh: realSesh,
      p_token_hash: createHash("sha256").update(realToken).digest("hex"),
      p_max_uses: 5,
      p_expires_at: null,
    });
    if (mintError) throw new Error(`mint failed: ${mintError.message}`);
  }, 180_000);

  afterAll(async () => {
    for (const id of made) await service.auth.admin.deleteUser(id);
  }, 120_000);

  describe("the flag", () => {
    it("copies each row's realm from its owner, whatever the writer sends", async () => {
      const { data } = await service.from("seshes").select("id, is_demo").in("id", [realSesh, castSesh]);
      const realm = Object.fromEntries((data ?? []).map((r) => [r.id, r.is_demo]));
      expect(realm).toEqual({ [realSesh]: false, [castSesh]: true });

      const { data: rsvp } = await service
        .from("rsvps")
        .select("is_demo")
        .eq("sesh_id", castSesh)
        .eq("member_id", castGuest.id)
        .single();
      expect(rsvp!.is_demo).toBe(true);
    });

    it("cannot be written by a member", async () => {
      const { error } = await realGuest.db.from("profiles").update({ is_demo: true }).eq("id", realGuest.id);
      expect(error?.code).toBe("42501");
    });

    it("refuses an RSVP across realms even from service_role", async () => {
      const { error } = await service.from("rsvps").insert({ sesh_id: realSesh, member_id: visitor.id, status: "approved" });
      expect(error?.code).toBe("42501");
    });
  });

  describe("the wall between realms", () => {
    it("keeps each realm's seshes out of the other's feed and search", async () => {
      const ids = [realSesh, castSesh];
      const real = await realGuest.db.from("seshes").select(LIST).in("id", ids);
      const demo = await visitor.db.from("seshes").select(LIST).in("id", ids);
      expect(real.data!.map((r) => r.id)).toEqual([realSesh]);
      expect(demo.data!.map((r) => r.id)).toEqual([castSesh]);

      const realSearch = await realGuest.db.from("seshes").select("id").textSearch("search_vector", MARKER);
      const demoSearch = await visitor.db.from("seshes").select("id").textSearch("search_vector", MARKER);
      expect(realSearch.data!.map((r) => r.id)).not.toContain(castSesh);
      expect(demoSearch.data!.map((r) => r.id)).not.toContain(realSesh);

      const all = await service.from("seshes").select("id").in("id", ids);
      expect(all.data).toHaveLength(2);
    });

    it("keeps each realm out of the other's directory", async () => {
      const ids = [realHost.id, realGuest.id, castHost.id, castGuest.id];
      const real = await realGuest.db.from("profiles").select("id").in("id", ids);
      const demo = await visitor.db.from("profiles").select("id").in("id", ids);
      expect(real.data!.map((r) => r.id).sort()).toEqual([realHost.id, realGuest.id].sort());
      expect(demo.data!.map((r) => r.id).sort()).toEqual([castHost.id, castGuest.id].sort());
    });

    it("keeps each realm's RSVPs from the other", async () => {
      const toReal = await visitor.db.from("rsvps").select("id").eq("sesh_id", realSesh);
      const toCast = await realHost.db.from("rsvps").select("id").eq("sesh_id", castSesh);
      expect(toReal.data).toEqual([]);
      expect(toCast.data).toEqual([]);
      const truth = await service.from("rsvps").select("id").in("sesh_id", [realSesh, castSesh]);
      expect(truth.data!.length).toBeGreaterThanOrEqual(2);
    });

    it("refuses an RSVP request across realms with the same answer as any closed sesh", async () => {
      const intoReal = await visitor.db.rpc("request_rsvp", { p_sesh: realSesh });
      const intoDemo = await realGuest.db.rpc("request_rsvp", { p_sesh: castSesh });
      expect(intoReal.error?.code).toBe(NOT_TAKING_REQUESTS);
      expect(intoDemo.error?.code).toBe(NOT_TAKING_REQUESTS);
    });

    it("never gives the other realm an exact location", async () => {
      const visitorOnReal = await visitor.db.rpc("sesh_address", { p_sesh: realSesh });
      const realOnCast = await realGuest.db.rpc("sesh_address", { p_sesh: castSesh });
      expect(visitorOnReal.data).toEqual([]);
      expect(realOnCast.data).toEqual([]);

      // The differential: each realm's approved guest DOES read their own.
      const realOnReal = await realGuest.db.rpc("sesh_address", { p_sesh: realSesh });
      const castOnCast = await castGuest.db.rpc("sesh_address", { p_sesh: castSesh });
      expect(realOnReal.data).toHaveLength(1);
      expect(castOnCast.data).toHaveLength(1);
    });

    it("gives an approved visitor the cast sesh's exact location", async () => {
      const { data } = await otherVisitor.db.rpc("sesh_address", { p_sesh: castSesh });
      expect(data).toHaveLength(1);
      expect(data![0].address_line).toBe("1 Probe Street");
    });
  });

  describe("visitors are walled off from each other", () => {
    it("hides another visitor's profile, and shows the cast and yourself", async () => {
      const { data } = await visitor.db.from("profiles").select("id").in("id", [otherVisitor.id, visitor.id, castHost.id]);
      expect(data!.map((r) => r.id).sort()).toEqual([visitor.id, castHost.id].sort());
    });

    it("hides another visitor's sesh", async () => {
      const mine = await visitor.db.from("seshes").select("id").eq("id", otherVisitorSesh);
      const theirs = await otherVisitor.db.from("seshes").select("id").eq("id", otherVisitorSesh);
      expect(mine.data).toEqual([]);
      expect(theirs.data).toHaveLength(1);
      const ask = await visitor.db.rpc("request_rsvp", { p_sesh: otherVisitorSesh });
      expect(ask.error?.code).toBe(NOT_TAKING_REQUESTS);
    });

    it("hides another visitor's RSVP and on-deck row on a cast sesh", async () => {
      await approvedRsvp(castSesh, visitor.id);

      const rsvps = await visitor.db.from("rsvps").select("member_id").eq("sesh_id", castSesh);
      const members = rsvps.data!.map((r) => r.member_id);
      expect(members).toContain(castGuest.id);
      expect(members).toContain(visitor.id);
      expect(members).not.toContain(otherVisitor.id);

      const bring = await visitor.db.from("contributions").select("member_id, label").eq("sesh_id", castSesh);
      expect(bring.data!.map((r) => r.member_id)).toEqual([castGuest.id]);

      const truth = await service.from("contributions").select("member_id").eq("sesh_id", castSesh);
      expect(truth.data!.map((r) => r.member_id)).toContain(otherVisitor.id);
    });
  });

  describe("nothing a visitor does changes what the next one sees", () => {
    it("leaves the cast sesh's seat count alone when a visitor is approved", async () => {
      const before = await countOf(castSesh);
      const fresh = await makeVisitor();
      await approvedRsvp(castSesh, fresh.id);
      expect(await countOf(castSesh)).toBe(before);

      // The differential: a cast guest's approval does move it.
      const extra = await makeCast("extra");
      await approvedRsvp(castSesh, extra.id);
      expect(await countOf(castSesh)).toBe(before + 1);
    });

    it("writes no notification to a cast member, and still writes one to a visitor", async () => {
      const row = (recipient: string) => ({ recipient_id: recipient, type: "rsvp_requested", sesh_id: castSesh, actor_id: visitor.id });
      await service.from("notifications").insert(row(castHost.id));
      await service.from("notifications").insert(row(visitor.id));
      await service.from("notifications").insert(row(realHost.id));

      const cast = await service.from("notifications").select("id").eq("recipient_id", castHost.id);
      const mine = await service.from("notifications").select("id").eq("recipient_id", visitor.id);
      const real = await service.from("notifications").select("id").eq("recipient_id", realHost.id);
      expect(cast.data).toEqual([]);
      expect(mine.data).toHaveLength(1);
      expect(real.data).toHaveLength(1);
    });
  });

  describe("what a visitor may do", () => {
    it("edits their own profile", async () => {
      const { error } = await visitor.db.from("profiles").update({ bio: "Just looking", city: "Miami" }).eq("id", visitor.id);
      expect(error).toBeNull();
      const { data } = await service.from("profiles").select("bio").eq("id", visitor.id).single();
      expect(data!.bio).toBe("Just looking");
    });

    it("asks to join a cast sesh, and the request stays requested", async () => {
      const cast2 = await mustInsertSesh(castHost);
      const { error } = await visitor.db.rpc("request_rsvp", { p_sesh: cast2 });
      expect(error).toBeNull();
      const { data } = await visitor.db.from("rsvps").select("status").eq("sesh_id", cast2).eq("member_id", visitor.id).single();
      expect(data!.status).toBe("requested");
    });

    it("adds to the on-deck list of a sesh they are approved for", async () => {
      const { error } = await visitor.db
        .from("contributions")
        .insert({ sesh_id: castSesh, member_id: visitor.id, kind: "item", label: "Lemonade" });
      expect(error).toBeNull();
    });

    it("hosts three seshes and not a fourth", async () => {
      const host = await makeVisitor();
      const first = await mustInsertSesh(host);
      for (let i = 0; i < 2; i++) await mustInsertSesh(host);

      // A cancelled sesh still counts, or cancel-and-create has no end.
      const cancel = await host.db.from("seshes").update({ status: "cancelled" }).eq("id", first).select("id");
      expect(cancel.data).toHaveLength(1);

      const fourth = await insertSesh(host);
      expect(fourth.error?.code).toBe("42501");

      // The differential: the same insert as service_role lands.
      const { error } = await service.from("seshes").insert({
        host_id: host.id, title: "Fourth", sesh_type: "chill", starts_at: hoursFromNow(48), capacity: 4,
      });
      expect(error).toBeNull();
    });
  });

  describe("what a visitor may not do", () => {
    it("changes no cast row", async () => {
      const sesh = await visitor.db.from("seshes").update({ title: "Hijacked" }).eq("id", castSesh).select("id");
      const profile = await visitor.db.from("profiles").update({ bio: "Hijacked" }).eq("id", castHost.id).select("id");
      expect(sesh.data).toEqual([]);
      expect(profile.data).toEqual([]);

      const { data } = await service.from("seshes").select("title").eq("id", castSesh).single();
      expect(data!.title).toBe(`Probe ${MARKER}`);

      const own = await castHost.db.from("seshes").update({ title: `Probe ${MARKER}` }).eq("id", castSesh).select("id");
      expect(own.data).toHaveLength(1);
    });

    it("changes no handle", async () => {
      const { error } = await visitor.db.rpc("change_handle", { p_handle: `v${Date.now().toString(36)}` });
      expect(error?.code).toBe(NOT_IN_THE_DEMO);
      const real = await realGuest.db.rpc("change_handle", { p_handle: `r${Date.now().toString(36)}` });
      expect(real.error).toBeNull();
    });

    it("mints no invite and redeems none", async () => {
      const own = await mustInsertSesh(visitor);
      const mint = await visitor.db.rpc("mint_invite", {
        p_sesh: own,
        p_token_hash: createHash("sha256").update(randomBytes(24)).digest("hex"),
        p_max_uses: 1,
        p_expires_at: null,
      });
      expect(mint.error?.code).toBe(NOT_IN_THE_DEMO);

      const hash = createHash("sha256").update(realToken).digest("hex");
      const redeem = await visitor.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(redeem.error?.code).toBe(NOT_IN_THE_DEMO);
      const real = await realGuest.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(real.error).toBeNull();
    });

    it("decides no RSVP", async () => {
      const { data } = await service.from("rsvps").select("id").eq("sesh_id", castSesh).eq("member_id", castGuest.id).single();
      const { error } = await visitor.db.rpc("decide_rsvp", { p_rsvp: data!.id, p_decision: "denied" });
      expect(error?.code).toBe(NOT_IN_THE_DEMO);
    });

    it("registers no push endpoint", async () => {
      const sub = (member: Member) => ({
        member_id: member.id,
        endpoint: `https://push.example.test/${member.id}`,
        p256dh: "k",
        auth: "a",
      });
      const demo = await visitor.db.from("push_subscriptions").insert(sub(visitor));
      expect(demo.error?.code).toBe("42501");
      const real = await realGuest.db.from("push_subscriptions").insert(sub(realGuest));
      expect(real.error).toBeNull();
    });
  });

  describe("an anonymous identity nobody pressed a button for", () => {
    it("sees nothing and writes nothing", async () => {
      const seshes = await stray.db.from("seshes").select("id").in("id", [realSesh, castSesh]);
      expect(seshes.data).toEqual([]);

      const bio = await stray.db.from("profiles").update({ bio: "Squatting" }).eq("id", stray.id).select("id");
      expect(bio.data).toEqual([]);

      const handle = await stray.db.rpc("change_handle", { p_handle: `s${Date.now().toString(36)}` });
      expect(handle.error?.code).toBe(NOT_IN_THE_DEMO);

      const hash = createHash("sha256").update(realToken).digest("hex");
      const redeem = await stray.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(redeem.error?.code).toBe(NOT_IN_THE_DEMO);
    });
  });
});
