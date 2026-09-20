/** @vitest-environment node
 *
 *  The RSVP lifecycle, tested through PostgREST against the real project.
 *  Skipped without the service key.
 *
 *  Every security claim is proved DIFFERENTIALLY: the same statement on the
 *  same row fails for a member and succeeds for service_role. No live rule is
 *  weakened anywhere to make a test go red.
 *
 *  Nothing in this ticket unlocks the address. There is a test at the bottom
 *  that says so, because "approved" is exactly the word that will one day
 *  tempt somebody to wire it up here instead of in the unlock rule.
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
const TAMPA = { lat: 27.9506, lng: -82.4572 };

/** Raised by the database, mapped to plain words by the server action. */
const NOT_ACTIVE = "M4W10";
const SESH_CLOSED = "M4W11";
const HOST_CANNOT_ASK = "M4W12";
const KICKED = "M4W13";
const FULL = "M4W14";
const NOT_THE_HOST = "M4W15";
const BELOW_APPROVED = "M4W16";
const TOO_MANY_TODAY = "M4W17";

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe.skipIf(!configured)("RSVP", () => {
  let service: SupabaseClient;
  let host: Member;
  let guest: Member;
  let other: Member;
  let expired: Member;
  const racers: Member[] = [];
  const created: string[] = [];

  async function makeMember(tag: string, status: "verified" | "expired" = "verified"): Promise<Member> {
    const email = `rsvp-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@meet4weed.test`;
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

  /** Seshes are set up with service_role on purpose: the five-open-sesh cap
   *  is a rule about hosting, already proved in sesh-rls.test.ts, and it is
   *  not what any test here is about. */
  async function makeSesh(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Test sesh",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
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
  const decide = (as: Member, rsvp: string, decision: string) =>
    as.db.rpc("decide_rsvp", { p_rsvp: rsvp, p_decision: decision });

  async function rsvpIdFor(sesh: string, member: string): Promise<string> {
    const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh).eq("member_id", member).single();
    return data!.id as string;
  }

  const statusOf = async (sesh: string, member: string) =>
    (await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", member).single()).data?.status;

  const seatsTaken = async (sesh: string) =>
    (await service.from("seshes").select("approved_count").eq("id", sesh).single()).data?.approved_count;

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host");
    guest = await makeMember("guest");
    other = await makeMember("other");
    expired = await makeMember("expired", "expired");
    for (let i = 0; i < 4; i++) racers.push(await makeMember(`racer${i}`));
  }, 180_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    for (const m of [host, guest, other, expired, ...racers]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 180_000);

  describe("asking to come", () => {
    it("puts a member's request in front of the host", async () => {
      const sesh = await makeSesh();

      const { error } = await ask(guest, sesh);

      expect(error).toBeNull();
      expect(await statusOf(sesh, guest.id)).toBe("requested");
    });

    it("lets a member see their own request and nobody else's", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await ask(other, sesh);

      const { data } = await guest.db.from("rsvps").select("member_id").eq("sesh_id", sesh);

      expect(data).toEqual([{ member_id: guest.id }]);
    });

    it("lets a member withdraw, which frees the seat", async () => {
      const sesh = await makeSesh({ capacity: 1 });
      await ask(guest, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");
      expect(await seatsTaken(sesh)).toBe(1);

      await withdraw(guest, sesh);

      expect(await statusOf(sesh, guest.id)).toBe("cancelled");
      expect(await seatsTaken(sesh)).toBe(0);
    });

    it("lets a denied member ask again another time", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "denied");

      const { error } = await ask(guest, sesh);

      expect(error).toBeNull();
      expect(await statusOf(sesh, guest.id)).toBe("requested");
    });

    it("will not let a removed member come back", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "kicked");

      const { error } = await ask(guest, sesh);

      expect(error?.code).toBe(KICKED);
      expect(await statusOf(sesh, guest.id)).toBe("kicked");
    });

    it("will not let a host be a guest at their own sesh", async () => {
      const sesh = await makeSesh();

      expect((await ask(host, sesh)).error?.code).toBe(HOST_CANNOT_ASK);
    });

    it("will not take a request for a cancelled sesh", async () => {
      const sesh = await makeSesh({ status: "cancelled" });

      expect((await ask(guest, sesh)).error?.code).toBe(SESH_CLOSED);
    });

    it("will not take a request for a sesh that has already started", async () => {
      const sesh = await makeSesh({ starts_at: hoursFromNow(-2) });

      expect((await ask(guest, sesh)).error?.code).toBe(SESH_CLOSED);
    });

    it("will not take a request for a sesh whose host's card has lapsed", async () => {
      const sesh = await makeSesh();
      await service.from("profiles").update({ card_expires_on: isoDay(-3) }).eq("id", host.id);

      const { error } = await ask(guest, sesh);

      await service.from("profiles").update({ card_expires_on: isoDay(200) }).eq("id", host.id);
      expect(error?.code).toBe(SESH_CLOSED);
    });

    it("will not take a request from a member whose own card has lapsed", async () => {
      const sesh = await makeSesh();

      expect((await ask(expired, sesh)).error?.code).toBe(NOT_ACTIVE);
    });

    it("stops a member spraying every sesh in Florida", async () => {
      const seshes: string[] = [];
      for (let i = 0; i < 21; i++) seshes.push(await makeSesh({ title: `Sesh ${i}` }));

      const results = [];
      for (const sesh of seshes) results.push(await ask(other, sesh));

      expect(results.slice(0, 20).every((r) => r.error === null)).toBe(true);
      expect(results[20].error?.code).toBe(TOO_MANY_TODAY);
    }, 120_000);
  });

  describe("writing to the table directly", () => {
    it("cannot be inserted by a member, but can by service_role", async () => {
      const sesh = await makeSesh();

      const asMember = await guest.db.from("rsvps").insert({ sesh_id: sesh, member_id: guest.id });
      const asService = await service.from("rsvps").insert({ sesh_id: sesh, member_id: guest.id });

      expect(asMember.error).not.toBeNull();
      expect(asService.error).toBeNull();
    });

    /** The whole reason writes go through functions. A member who can name
     *  the status column can approve themselves. */
    it("cannot be approved by the member it belongs to", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);

      const asMember = await guest.db.from("rsvps").update({ status: "approved" }).eq("sesh_id", sesh);
      const asService = await service.from("rsvps").update({ status: "approved" }).eq("sesh_id", sesh);

      expect(asMember.error).not.toBeNull();
      expect(asService.error).toBeNull();
    });
  });

  describe("the host deciding", () => {
    it("approves somebody", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);

      const { error } = await decide(host, await rsvpIdFor(sesh, guest.id), "approved");

      expect(error).toBeNull();
      expect(await statusOf(sesh, guest.id)).toBe("approved");
      expect(await seatsTaken(sesh)).toBe(1);
    });

    it("denies somebody without having to say why", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);

      await decide(host, await rsvpIdFor(sesh, guest.id), "denied");

      expect(await statusOf(sesh, guest.id)).toBe("denied");
      expect(await seatsTaken(sesh)).toBe(0);
    });

    it("removes somebody already approved, and the seat comes back", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      const rsvp = await rsvpIdFor(sesh, guest.id);
      await decide(host, rsvp, "approved");

      await decide(host, rsvp, "kicked");

      expect(await statusOf(sesh, guest.id)).toBe("kicked");
      expect(await seatsTaken(sesh)).toBe(0);
    });

    it("cannot be done by somebody who is not the host", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      const rsvp = await rsvpIdFor(sesh, guest.id);

      expect((await decide(other, rsvp, "approved")).error?.code).toBe(NOT_THE_HOST);
      expect((await decide(guest, rsvp, "approved")).error?.code).toBe(NOT_THE_HOST);
      expect(await statusOf(sesh, guest.id)).toBe("requested");
    });

    it("cannot be done on a cancelled sesh", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      const rsvp = await rsvpIdFor(sesh, guest.id);
      await service.from("seshes").update({ status: "cancelled" }).eq("id", sesh);

      expect((await decide(host, rsvp, "approved")).error?.code).toBe(SESH_CLOSED);
    });
  });

  describe("capacity", () => {
    it("refuses the approval that would go over", async () => {
      const sesh = await makeSesh({ capacity: 1 });
      await ask(guest, sesh);
      await ask(other, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");

      const { error } = await decide(host, await rsvpIdFor(sesh, other.id), "approved");

      expect(error?.code).toBe(FULL);
      expect(await seatsTaken(sesh)).toBe(1);
    });

    /** The real thing, not a comment. Four members all want the one seat and
     *  the host approves them all at the same moment. decide_rsvp takes the
     *  sesh row with FOR UPDATE before it counts, so the approvals serialise
     *  and the second one sees the true number.
     *
     *  Honest limit: requests can serialise by luck even with no lock, so one
     *  winner is strong evidence rather than proof. The seat count assertion
     *  is the one that catches a missing lock outright. */
    it("gives the last seat to exactly one of four people asking at once", async () => {
      const sesh = await makeSesh({ capacity: 1 });
      for (const racer of racers) await ask(racer, sesh);
      const rsvps = await Promise.all(racers.map((r) => rsvpIdFor(sesh, r.id)));

      const results = await Promise.all(rsvps.map((rsvp) => decide(host, rsvp, "approved")));

      const won = results.filter((r) => r.error === null);
      expect(won).toHaveLength(1);
      expect(results.filter((r) => r.error?.code === FULL)).toHaveLength(3);
      expect(await seatsTaken(sesh)).toBe(1);
    }, 60_000);

    it("never lets the seat count run past capacity", async () => {
      const sesh = await makeSesh({ capacity: 2 });
      for (const racer of racers) await ask(racer, sesh);
      const rsvps = await Promise.all(racers.map((r) => rsvpIdFor(sesh, r.id)));

      await Promise.all(rsvps.map((rsvp) => decide(host, rsvp, "approved")));

      expect(await seatsTaken(sesh)).toBeLessThanOrEqual(2);
    }, 60_000);

    it("will not let a host shrink a sesh below the people already in it", async () => {
      const sesh = await makeSesh({ capacity: 6 });
      await ask(guest, sesh);
      await ask(other, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");
      await decide(host, await rsvpIdFor(sesh, other.id), "approved");

      const { error } = await host.db.from("seshes").update({ capacity: 1 }).eq("id", sesh);

      expect(error?.code).toBe(BELOW_APPROVED);
    });

    it("lets a host shrink it as far as the people already in it", async () => {
      const sesh = await makeSesh({ capacity: 6 });
      await ask(guest, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");

      const { error } = await host.db.from("seshes").update({ capacity: 1 }).eq("id", sesh);

      expect(error).toBeNull();
    });
  });

  describe("the guest list", () => {
    it("is visible to somebody who is coming", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await ask(other, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");
      await decide(host, await rsvpIdFor(sesh, other.id), "approved");

      const { data } = await guest.db.from("rsvps").select("member_id").eq("sesh_id", sesh).eq("status", "approved");

      expect(data).toHaveLength(2);
    });

    /** Otherwise asking to join every sesh becomes a way to read the
     *  membership list. */
    it("is not visible to somebody who has only asked", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await ask(other, sesh);
      await decide(host, await rsvpIdFor(sesh, other.id), "approved");

      const { data } = await guest.db.from("rsvps").select("member_id").eq("sesh_id", sesh);

      expect(data).toEqual([{ member_id: guest.id }]);
    });

    it("is entirely visible to the host, waiting and all", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await ask(other, sesh);

      const { data } = await host.db.from("rsvps").select("member_id").eq("sesh_id", sesh);

      expect(data).toHaveLength(2);
    });
  });

  describe("the address", () => {
    /** Nothing in this ticket unlocks it. The guest branch is #8, and this
     *  test is here so that wiring it up anywhere else goes red. */
    it("stays shut to an approved guest until the unlock rule says otherwise", async () => {
      const sesh = await makeSesh();
      await ask(guest, sesh);
      await decide(host, await rsvpIdFor(sesh, guest.id), "approved");

      const { data } = await guest.db.rpc("sesh_address", { p_sesh: sesh });

      expect(data).toEqual([]);
    });
  });
});
