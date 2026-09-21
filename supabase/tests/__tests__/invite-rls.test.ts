/** @vitest-environment node
 *
 *  Plan 04, ticket #30 — invites: mint and redeem.
 *
 *  The claims under test, in one breath: a host hands somebody a link, that
 *  person can ask to come, THE HOST STILL APPROVES BY HAND, a use is spent by
 *  a press and never by a page load, and holding a link is NO input to the
 *  address-unlock rule that shipped in #8.
 *
 *  That last one is why the "a claimant and the address" block below re-runs
 *  the whole shipped unlock matrix with a claimant added to it. A forwarded
 *  link must not be able to produce a street address, and the way to prove it
 *  is not to assert that one call returns nothing — it is to walk every
 *  actor again and show the answers did not move.
 *
 *  Every security claim is proved DIFFERENTIALLY: the same statement on the
 *  same row fails for a member and succeeds for service_role. No live rule is
 *  ever weakened to make a test go red.
 *
 *  The token itself never appears here, and does not need to: the database
 *  only ever sees sha256 of it, so these tests hand it a random hash of the
 *  right shape. lib/sesh/__tests__/invite-token.test.ts (#29) is what proves
 *  the token half.
 *
 *  Skipped without SUPABASE_SECRET_KEY, so CI never runs it.
 */
import { createHash, randomUUID } from "node:crypto";
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

/** ONE code for every way redeeming can fail. The point of this constant is
 *  that no test below ever expects a different one. */
const LINK_DOES_NOT_WORK = "M4W19";
const CANNOT_MINT = "M4W20";
const FIVE_LIVE_LINKS = "M4W21";
const BAD_USES = "M4W22";
const CARD_NOT_CURRENT = "M4W10";

const TAMPA = { lat: 27.9506, lng: -82.4572 };
const STREET = "1 Test Street";
const UNIT = "Apt 2";
const GATE = "1234";

const MARKER = `inviteprobe${Date.now()}`;

type Member = { id: string; db: SupabaseClient };
type MemberStatus = "verified" | "expired" | "unverified" | "pending_review" | "suspended";

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/** The database stores sha256(token) and nothing else, so a test never needs
 *  a real token to exercise it. */
const freshHash = () => createHash("sha256").update(randomUUID()).digest("hex");

describe.skipIf(!configured)("invites", () => {
  let service: SupabaseClient;
  let host: Member;
  let claimer: Member;
  let other: Member;
  let stranger: Member;
  let unverified: Member;
  let suspended: Member;
  const created: string[] = [];

  async function makeMember(tag: string, status: MemberStatus = "verified"): Promise<Member> {
    const email = `invite-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    await setStatus(data.user.id, status);
    return { id: data.user.id, db };
  }

  const setStatus = (id: string, status: MemberStatus, days = 200) =>
    service
      .from("profiles")
      .update({
        status,
        card_expires_on: status === "expired" ? isoDay(-1) : isoDay(days),
        attested_at: new Date().toISOString(),
      })
      .eq("id", id);

  /** Created through the host's own session, so the column grants and the
   *  insert policy are on the path — never a service_role shortcut. */
  async function makeSesh(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await host.db
      .from("seshes")
      .insert({
        host_id: host.id,
        title: `Probe ${MARKER}`,
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
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

  const mint = (as: Member, sesh: string, hash: string, uses = 1, expiresAt = hoursFromNow(24)) =>
    as.db.rpc("mint_invite", {
      p_sesh: sesh,
      p_token_hash: hash,
      p_max_uses: uses,
      p_expires_at: expiresAt,
    });

  /** Setup, never the thing under test. A refused mint would otherwise leave
   *  every assertion after it passing for the wrong reason. */
  async function mustMint(sesh: string, uses = 1, expiresAt = hoursFromNow(24)) {
    const hash = freshHash();
    const { data, error } = await mint(host, sesh, hash, uses, expiresAt);
    if (error) throw new Error(`could not mint: ${error.message}`);
    return { hash, id: (data as Record<string, unknown>[])[0].invite_id as string };
  }

  const preview = (as: Member, hash: string) => as.db.rpc("invite_preview", { p_token_hash: hash });
  const redeem = (as: Member, hash: string) => as.db.rpc("redeem_invite", { p_token_hash: hash });
  const revoke = (as: Member, invite: string) => as.db.rpc("revoke_invite", { p_invite: invite });

  const inviteRow = async (id: string) =>
    (await service.from("invites").select("use_count, max_uses, revoked_at, expires_at").eq("id", id).single())
      .data as Record<string, unknown>;

  const useCountOf = async (id: string) => (await inviteRow(id)).use_count as number;

  const claimCount = async (sesh: string) =>
    (await service.from("invite_claims").select("invite_id", { count: "exact", head: true }).eq("sesh_id", sesh))
      .count ?? 0;

  /** Can this member see the sesh exists at all. */
  const canSee = async (as: Member, sesh: string) =>
    (await as.db.from("seshes").select("id").eq("id", sesh).maybeSingle()).data !== null;

  /** The ONLY way to read an address. An empty array is the locked state. */
  const addressFor = async (as: Member, sesh: string) =>
    ((await as.db.rpc("sesh_address", { p_sesh: sesh })).data as unknown[] | null) ?? [];

  const ask = (as: Member, sesh: string) => as.db.rpc("request_rsvp", { p_sesh: sesh });

  async function mustAsk(as: Member, sesh: string) {
    const { error } = await ask(as, sesh);
    if (error) throw new Error(`could not ask for a seat: ${error.message}`);
  }

  async function decide(sesh: string, member: Member, decision: string) {
    const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh).eq("member_id", member.id).single();
    const { error } = await host.db.rpc("decide_rsvp", { p_rsvp: data!.id as string, p_decision: decision });
    if (error) throw new Error(`could not ${decision}: ${error.message}`);
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host");
    claimer = await makeMember("claimer");
    other = await makeMember("other");
    stranger = await makeMember("stranger");
    unverified = await makeMember("unverified", "unverified");
    suspended = await makeMember("suspended", "suspended");
  }, 180_000);

  afterEach(async () => {
    // Invites and claims cascade from the sesh, so deleting the sesh is
    // enough. The host's card is put back in case a test lapsed it.
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
    await setStatus(host.id, "verified");
  });

  afterAll(async () => {
    for (const m of [host, claimer, other, stranger, unverified, suspended]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 180_000);

  // -------------------------------------------------------------------------

  describe("a host minting a link", () => {
    it("makes one for their own sesh", async () => {
      const sesh = await makeSesh();

      const { data, error } = await mint(host, sesh, freshHash(), 3);

      expect(error).toBeNull();
      const row = (data as Record<string, unknown>[])[0];
      expect(row.max_uses).toBe(3);
      expect(row.invite_id).toBeTruthy();
    });

    it("defaults nothing it was not given — one use is the caller's choice, not a surprise", async () => {
      const sesh = await makeSesh();

      const { data } = await mint(host, sesh, freshHash(), 1);

      expect((data as Record<string, unknown>[])[0].max_uses).toBe(1);
    });

    /** Differential: the same sesh, the same statement. The host can, the
     *  stranger cannot, and service_role can write the row outright. */
    it("refuses a link for somebody else's sesh, and allows service_role", async () => {
      const sesh = await makeSesh();

      const asStranger = await mint(stranger, sesh, freshHash(), 1);
      const asHost = await mint(host, sesh, freshHash(), 1);
      const asService = await service
        .from("invites")
        .insert({ sesh_id: sesh, created_by: host.id, token_hash: freshHash(), expires_at: hoursFromNow(5) });

      expect(asStranger.error?.code).toBe(CANNOT_MINT);
      expect(asHost.error).toBeNull();
      expect(asService.error).toBeNull();
    });

    it("refuses a sixth live link on one sesh", async () => {
      const sesh = await makeSesh();
      for (let i = 0; i < 5; i += 1) await mustMint(sesh);

      const sixth = await mint(host, sesh, freshHash(), 1);

      expect(sixth.error?.code).toBe(FIVE_LIVE_LINKS);
    });

    it("counts a revoked link as dead, so the host can make another", async () => {
      const sesh = await makeSesh();
      const first = await mustMint(sesh);
      for (let i = 0; i < 4; i += 1) await mustMint(sesh);

      const blocked = await mint(host, sesh, freshHash(), 1);
      await revoke(host, first.id);
      const allowed = await mint(host, sesh, freshHash(), 1);

      expect(blocked.error?.code).toBe(FIVE_LIVE_LINKS);
      expect(allowed.error).toBeNull();
    });

    /** A link that outlives the thing it leads to is a link to nothing. */
    it("clamps an expiry later than the sesh start down to the start", async () => {
      const sesh = await makeSesh({ starts_at: hoursFromNow(10) });
      const { id } = await mustMint(sesh, 1, hoursFromNow(400));

      const { data } = await service.from("seshes").select("starts_at").eq("id", sesh).single();

      expect((await inviteRow(id)).expires_at).toBe(data!.starts_at);
    });

    it("leaves an expiry before the sesh start alone", async () => {
      const sesh = await makeSesh({ starts_at: hoursFromNow(100) });
      const wanted = hoursFromNow(10);
      const { id } = await mustMint(sesh, 1, wanted);

      expect(new Date((await inviteRow(id)).expires_at as string).getTime()).toBeCloseTo(
        new Date(wanted).getTime(),
        -4,
      );
    });

    it("refuses an eleventh use and a zeroth", async () => {
      const sesh = await makeSesh();

      expect((await mint(host, sesh, freshHash(), 11)).error?.code).toBe(BAD_USES);
      expect((await mint(host, sesh, freshHash(), 0)).error?.code).toBe(BAD_USES);
    });

    it("refuses an expiry that has already passed", async () => {
      const sesh = await makeSesh();

      const { error } = await mint(host, sesh, freshHash(), 1, hoursFromNow(-1));

      expect(error?.code).toBe(BAD_USES);
    });

    it("refuses a host whose card has lapsed", async () => {
      const sesh = await makeSesh();
      await setStatus(host.id, "expired");

      const { error } = await mint(host, sesh, freshHash(), 1);

      expect(error?.code).toBe(CARD_NOT_CURRENT);
    });

    it("refuses a cancelled sesh and one that has already started", async () => {
      const cancelled = await makeSesh();
      await service.from("seshes").update({ status: "cancelled" }).eq("id", cancelled);
      const started = await makeSesh();
      await service.from("seshes").update({ starts_at: hoursFromNow(-1) }).eq("id", started);

      expect((await mint(host, cancelled, freshHash(), 1)).error?.code).toBe(CANNOT_MINT);
      expect((await mint(host, started, freshHash(), 1)).error?.code).toBe(CANNOT_MINT);
    });
  });

  // -------------------------------------------------------------------------

  describe("the GET spends nothing", () => {
    /** THE MOST IMPORTANT TEST IN THIS FILE. Every chat app fetches a pasted
     *  link to draw a preview card, and one use is the default. A link that
     *  spent itself on that fetch would be dead before the recipient saw it. */
    it("leaves the use count unchanged however many times it is previewed", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 1);

      for (let i = 0; i < 6; i += 1) await preview(claimer, hash);

      expect(await useCountOf(id)).toBe(0);
      expect(await claimCount(sesh)).toBe(0);
    });

    it("spends exactly one on a single press", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 3);

      await preview(claimer, hash);
      await preview(claimer, hash);
      const { error } = await redeem(claimer, hash);
      await preview(claimer, hash);

      expect(error).toBeNull();
      expect(await useCountOf(id)).toBe(1);
    });

    /** Enough for a human to know what they are being let into, and no more.
     *  A link travels further than the person it was sent to. */
    it("returns the title and the start time and nothing else", async () => {
      const sesh = await makeSesh();
      // area_name carries an UPDATE grant but no INSERT one (#5), so it is
      // set the way a host actually sets it.
      await host.db.from("seshes").update({ area_name: "Ybor City" }).eq("id", sesh);
      const { hash } = await mustMint(sesh);

      const { data } = await preview(claimer, hash);
      const row = (data as Record<string, unknown>[])[0];

      expect(Object.keys(row).sort()).toEqual(["starts_at", "title"]);
      expect(row.title).toBe(`Probe ${MARKER}`);
      expect(JSON.stringify(row)).not.toContain("Ybor");
      expect(JSON.stringify(row)).not.toContain(STREET);
      expect(JSON.stringify(row)).not.toContain(sesh);
      expect(JSON.stringify(row)).not.toContain(host.id);
    });

    it("answers nothing at all for a hash that never existed", async () => {
      const { data, error } = await preview(claimer, freshHash());

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("answers nothing for an expired, a used-up and a revoked link alike", async () => {
      const sesh = await makeSesh();
      const expired = await mustMint(sesh);
      await service.from("invites").update({ expires_at: hoursFromNow(-1) }).eq("id", expired.id);
      const usedUp = await mustMint(sesh, 1);
      await redeem(claimer, usedUp.hash);
      const revoked = await mustMint(sesh);
      await revoke(host, revoked.id);

      expect((await preview(other, expired.hash)).data).toEqual([]);
      expect((await preview(other, usedUp.hash)).data).toEqual([]);
      expect((await preview(other, revoked.hash)).data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------

  describe("redeeming", () => {
    it("lands a verified member on the sesh, and they can then ask to come", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh);

      const before = await canSee(claimer, sesh);
      const { data, error } = await redeem(claimer, hash);
      const after = await canSee(claimer, sesh);
      const asked = await ask(claimer, sesh);

      expect(before).toBe(false);
      expect(error).toBeNull();
      expect(data).toBe(sesh);
      expect(after).toBe(true);
      expect(asked.error).toBeNull();
    });

    /** THE HOST STILL APPROVES. Redeeming writes a claim and never an RSVP. */
    it("writes no RSVP, so the host still decides", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);

      await redeem(claimer, hash);
      const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh);

      expect(data).toEqual([]);
      expect(await claimCount(sesh)).toBe(1);
    });

    it("burns no second use when the same member presses again", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 1);

      const first = await redeem(claimer, hash);
      const second = await redeem(claimer, hash);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(second.data).toBe(sesh);
      expect(await useCountOf(id)).toBe(1);
      expect(await claimCount(sesh)).toBe(1);
    });

    /** The row lock in redeem_invite() is what this proves. Both presses go
     *  out before either returns. */
    it("produces exactly one winner when two people press a one-use link at once", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 1);

      const [a, b] = await Promise.all([redeem(claimer, hash), redeem(other, hash)]);

      const winners = [a, b].filter((r) => r.error === null);
      const losers = [a, b].filter((r) => r.error !== null);

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0].error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(1);
      expect(await claimCount(sesh)).toBe(1);
    });

    it("lets a three-use link take three different people and refuse the fourth", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 2);

      expect((await redeem(claimer, hash)).error).toBeNull();
      expect((await redeem(other, hash)).error).toBeNull();
      expect((await redeem(stranger, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(2);
    });
  });

  // -------------------------------------------------------------------------

  describe("who a link gives nothing to", () => {
    it("a suspended member", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh);

      const { error } = await redeem(suspended, hash);

      expect(error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(0);
    });

    it("the host themselves", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh);

      const { error } = await redeem(host, hash);

      expect(error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(0);
    });

    /** A link is not a way around a host's decision. */
    it("somebody the host already removed", async () => {
      const sesh = await makeSesh();
      await mustAsk(other, sesh);
      await decide(sesh, other, "approved");
      await decide(sesh, other, "kicked");
      const { hash, id } = await mustMint(sesh);

      const { error } = await redeem(other, hash);

      expect(error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(0);
    });

    it("somebody the host already declined", async () => {
      const sesh = await makeSesh();
      await mustAsk(other, sesh);
      await decide(sesh, other, "denied");
      const { hash, id } = await mustMint(sesh);

      const { error } = await redeem(other, hash);

      expect(error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("what kills a link", () => {
    it("the host cancelling the sesh", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await service.from("seshes").update({ status: "cancelled" }).eq("id", sesh);

      expect((await redeem(claimer, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
      expect((await preview(claimer, hash)).data).toEqual([]);
    });

    it("the sesh starting", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await service.from("seshes").update({ starts_at: hoursFromNow(-1) }).eq("id", sesh);

      expect((await redeem(claimer, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
      expect((await preview(claimer, hash)).data).toEqual([]);
    });

    /** The HOST's card, not the caller's. Their link dies with it and comes
     *  back on renewal. */
    it("the host's card lapsing, and renewal brings it back", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);

      await setStatus(host.id, "expired");
      const whileLapsed = await redeem(claimer, hash);

      await setStatus(host.id, "verified");
      const afterRenewal = await redeem(claimer, hash);

      expect(whileLapsed.error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(afterRenewal.error).toBeNull();
    });

    it("the host revoking it", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 5);

      await revoke(host, id);

      expect((await redeem(claimer, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await useCountOf(id)).toBe(0);
    });

    /** Differential: the same link, the same statement. Only the host may. */
    it("and nobody but the host can revoke it", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 5);

      const asStranger = await revoke(stranger, id);
      const stillWorks = (await preview(claimer, hash)).data as unknown[];
      const asHost = await revoke(host, id);
      const nowDead = (await preview(claimer, hash)).data as unknown[];

      expect(asStranger.error?.code).toBe(CANNOT_MINT);
      expect(stillWorks).toHaveLength(1);
      expect(asHost.error).toBeNull();
      expect(nowDead).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------

  describe("a claim is permanent", () => {
    /** Revoking changes only what happens NEXT. A host already has a tool for
     *  removing somebody; a second, quieter one would remove people by
     *  accident before notifications ship in Plan 05. */
    it("revoking evicts nobody who already walked through", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash, id } = await mustMint(sesh, 5);
      await redeem(claimer, hash);

      await revoke(host, id);

      expect(await canSee(claimer, sesh)).toBe(true);
      expect((await redeem(other, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
    });

    it("a used-up link still lets the person who used it read the sesh", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh, 1);
      await redeem(claimer, hash);

      expect(await canSee(claimer, sesh)).toBe(true);
      expect(await canSee(other, sesh)).toBe(false);
    });

    it("an expired link does the same", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash, id } = await mustMint(sesh, 5);
      await redeem(claimer, hash);
      await service.from("invites").update({ expires_at: hoursFromNow(-1) }).eq("id", id);

      expect(await canSee(claimer, sesh)).toBe(true);
    });

    /** The one thing that DOES end a claim's visibility is an explicit
     *  decision by the host. */
    it("but being declined takes the sesh back out of view", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);

      const before = await canSee(claimer, sesh);
      await decide(sesh, claimer, "denied");
      const after = await canSee(claimer, sesh);

      expect(before).toBe(true);
      expect(after).toBe(false);
    });

    it("and so does being kicked", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);
      await decide(sesh, claimer, "approved");

      const before = await canSee(claimer, sesh);
      await decide(sesh, claimer, "kicked");
      const after = await canSee(claimer, sesh);

      expect(before).toBe(true);
      expect(after).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("a link waits for somebody still being reviewed", () => {
    /** The memory is a server-side row, not a cookie, which is what makes
     *  "the link waits for them" true across a multi-day card review. */
    it("records the claim for a member who is not verified yet", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh);

      const { error } = await redeem(unverified, hash);

      expect(error).toBeNull();
      expect(await claimCount(sesh)).toBe(1);
      expect(await useCountOf(id)).toBe(1);
    });

    it("and grants them nothing at all until they are", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(unverified, hash);

      const whileWaiting = await canSee(unverified, sesh);
      await setStatus(unverified.id, "verified");
      const afterReview = await canSee(unverified, sesh);
      await setStatus(unverified.id, "unverified");

      expect(whileWaiting).toBe(false);
      expect(afterReview).toBe(true);
    });

    /**
     * #31, THE WHOLE COLD PATH, END TO END AND AGAINST THE DATABASE.
     *
     * Somebody with no account presses an invite button, signs up, comes
     * back and presses again. By the time they press the second time they
     * are a real member whose card nobody has looked at yet — which is
     * exactly this member. The claim is written, the sesh stays shut, and
     * the day a reviewer approves the card the sesh is there and they can
     * ask to come.
     *
     * Proved on rows, not on a screen. The screen half is
     * app/invite/__tests__/held.test.tsx.
     */
    it("opens the sesh and lets them ask to come the day a reviewer approves them", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);

      // The second press, while the card is still unreviewed.
      expect((await redeem(unverified, hash)).error).toBeNull();

      const whileWaiting = await canSee(unverified, sesh);
      const askedWhileWaiting = await ask(unverified, sesh);

      await setStatus(unverified.id, "verified");
      const afterReview = await canSee(unverified, sesh);
      const askedAfterReview = await ask(unverified, sesh);
      await setStatus(unverified.id, "unverified");

      expect(whileWaiting).toBe(false);
      expect(askedWhileWaiting.error).not.toBeNull();
      expect(afterReview).toBe(true);
      expect(askedAfterReview.error).toBeNull();
    });

    /** A use spent by somebody who never finishes verification STAYS spent.
     *  Nothing about a link's liveness may depend on a future event — that is
     *  the race the row lock exists to kill. */
    it("keeps the use spent even if that person never comes back", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh, 1);
      await redeem(unverified, hash);

      expect(await useCountOf(id)).toBe(1);
      expect((await redeem(claimer, hash)).error?.code).toBe(LINK_DOES_NOT_WORK);
    });
  });

  // -------------------------------------------------------------------------

  describe("an unlisted sesh", () => {
    it("is invisible without a claim and visible with one", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh);

      const before = await canSee(claimer, sesh);
      await redeem(claimer, hash);
      const after = await canSee(claimer, sesh);

      expect(before).toBe(false);
      expect(after).toBe(true);
      // Nobody else moved.
      expect(await canSee(stranger, sesh)).toBe(false);
    });

    /** The branch is additive. A listed sesh was already readable by
     *  everybody, and a claim changes nothing about that. */
    it("a listed one is readable with or without a claim", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);

      expect(await canSee(stranger, sesh)).toBe(true);
      await redeem(claimer, hash);
      expect(await canSee(claimer, sesh)).toBe(true);
      expect(await canSee(stranger, sesh)).toBe(true);
    });

    /** A claimant may ask for a seat on an unlisted sesh. Before this
     *  migration the unlisted door (#28) let only somebody already holding a
     *  row through, and a claimant holds none. */
    it("takes a request from a claimant who holds no RSVP yet", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      const { error } = await ask(claimer, sesh);

      expect(error).toBeNull();
    });

    it("still refuses a stranger who never had a link", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });

      const { error } = await ask(stranger, sesh);

      expect(error?.code).toBe("M4W11");
    });

    /** The invite branch of the door does NOT loosen the rule #28 shipped:
     *  a denied member cannot let themselves back in, and holding a link is
     *  not the exception. private.has_invite_claim refuses a denied caller,
     *  so both halves of the door are shut on them. */
    it("refuses a claimant the host already declined", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh, 5);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);
      await decide(sesh, claimer, "denied");

      const askAgain = await ask(claimer, sesh);
      const pressAgain = await redeem(claimer, hash);

      expect(askAgain.error?.code).toBe("M4W11");
      expect(pressAgain.error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await canSee(claimer, sesh)).toBe(false);
    });

    /** And a kicked one is refused a step earlier, with its own code, exactly
     *  as it was before this migration. */
    it("refuses a claimant the host removed", async () => {
      const sesh = await makeSesh({ visibility: "unlisted" });
      const { hash } = await mustMint(sesh, 5);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);
      await decide(sesh, claimer, "approved");
      await decide(sesh, claimer, "kicked");

      const askAgain = await ask(claimer, sesh);

      expect(askAgain.error?.code).toBe("M4W13");
      expect(await canSee(claimer, sesh)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("a claimant and the address — the whole #8 matrix, unchanged", () => {
    /** HOLDING A LINK IS NO INPUT TO THE ADDRESS-UNLOCK RULE. That function
     *  is not modified by this plan, and this block walks every actor from
     *  #8 again with a claimant added to prove the answers did not move. A
     *  forwarded link cannot produce a street address. */
    it("gives a claimant who has done nothing else NOTHING", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      expect(await addressFor(claimer, sesh)).toEqual([]);
    });

    it("gives a claimant who has ASKED nothing either", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);

      expect(await addressFor(claimer, sesh)).toEqual([]);
    });

    it("gives a claimant who was DECLINED nothing", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);
      await decide(sesh, claimer, "denied");

      expect(await addressFor(claimer, sesh)).toEqual([]);
    });

    it("gives it to a claimant only once the host APPROVES them", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);

      const beforeApproval = await addressFor(claimer, sesh);
      await decide(sesh, claimer, "approved");
      const afterApproval = await addressFor(claimer, sesh);

      expect(beforeApproval).toEqual([]);
      expect(afterApproval).toHaveLength(1);
      expect((afterApproval[0] as Record<string, unknown>).address_line).toBe(STREET);
    });

    it("takes it back from an approved claimant the host removes", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);
      await mustAsk(claimer, sesh);
      await decide(sesh, claimer, "approved");

      await decide(sesh, claimer, "kicked");

      expect(await addressFor(claimer, sesh)).toEqual([]);
    });

    it("still gives it to the host", async () => {
      const sesh = await makeSesh();
      await mustMint(sesh);

      expect(await addressFor(host, sesh)).toHaveLength(1);
    });

    it("still refuses a stranger who never asked", async () => {
      const sesh = await makeSesh();
      await mustMint(sesh);

      expect(await addressFor(stranger, sesh)).toEqual([]);
    });

    /** Differential: the same columns, the same row. A claimant is refused by
     *  the column grants, and service_role reads them. */
    it("refuses the private columns to a claimant and gives them to service_role", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      const asMember = await claimer.db.from("seshes").select("address_line, gate_code").eq("id", sesh);
      const asService = await service.from("seshes").select("address_line, gate_code").eq("id", sesh);

      expect(asMember.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
      expect(asService.data![0].address_line).toBe(STREET);
    });

    it("fails a wildcard outright for a claimant rather than quietly trimming it", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      const { error } = await claimer.db.from("seshes").select("*").eq("id", sesh);

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  // -------------------------------------------------------------------------

  describe("one identical sentence", () => {
    /** Expired, used up, revoked, never existed, the host, a suspended member
     *  and a kicked one. Seven ways to be refused, ONE code — so no caller
     *  can tell a real token from a guess. */
    it("raises the same code for every refusal", async () => {
      const sesh = await makeSesh();

      const expired = await mustMint(sesh);
      await service.from("invites").update({ expires_at: hoursFromNow(-1) }).eq("id", expired.id);

      const usedUp = await mustMint(sesh, 1);
      await redeem(other, usedUp.hash);

      const revoked = await mustMint(sesh);
      await revoke(host, revoked.id);

      const live = await mustMint(sesh, 5);

      await mustAsk(stranger, sesh);
      await decide(sesh, stranger, "denied");

      const codes = await Promise.all(
        [
          redeem(claimer, expired.hash),
          redeem(claimer, usedUp.hash),
          redeem(claimer, revoked.hash),
          redeem(claimer, freshHash()),
          redeem(host, live.hash),
          redeem(suspended, live.hash),
          redeem(stranger, live.hash),
        ].map(async (p) => (await p).error?.code),
      );

      expect(codes).toEqual(Array(7).fill(LINK_DOES_NOT_WORK));
    });
  });

  // -------------------------------------------------------------------------

  describe("the tables themselves", () => {
    /** Only its hash is stored, and even that is unreadable to a member.
     *  A host's panel cannot rebuild a link even by accident. */
    it("refuses token_hash to the host who minted it, and gives it to service_role", async () => {
      const sesh = await makeSesh();
      const { hash, id } = await mustMint(sesh);

      const asHost = await host.db.from("invites").select("token_hash").eq("id", id);
      const asService = await service.from("invites").select("token_hash").eq("id", id);

      expect(asHost.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
      expect(asService.data![0].token_hash).toBe(hash);
    });

    it("fails a wildcard on invites rather than quietly trimming the hash", async () => {
      const sesh = await makeSesh();
      await mustMint(sesh);

      const { error } = await host.db.from("invites").select("*").eq("sesh_id", sesh);

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });

    it("lets the host read their own links and count the claims", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh, 2);
      await redeem(claimer, hash);

      const links = await host.db.from("invites").select("id, use_count, max_uses").eq("sesh_id", sesh);
      const claims = await host.db.from("invite_claims").select("invite_id, member_id").eq("sesh_id", sesh);

      expect(links.data).toHaveLength(1);
      expect(links.data![0].use_count).toBe(1);
      expect(claims.data).toHaveLength(1);
    });

    /** Differential: the same rows, the same statement. */
    it("hides a host's links from everybody else, and shows them to service_role", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      const asClaimer = await claimer.db.from("invites").select("id").eq("sesh_id", sesh);
      const asStranger = await stranger.db.from("invites").select("id").eq("sesh_id", sesh);
      const asService = await service.from("invites").select("id").eq("sesh_id", sesh);

      expect(asClaimer.data).toEqual([]);
      expect(asStranger.data).toEqual([]);
      expect(asService.data).toHaveLength(1);
    });

    it("shows a member their own claim and nobody else's", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh, 5);
      await redeem(claimer, hash);
      await redeem(other, hash);

      const mine = await claimer.db.from("invite_claims").select("member_id").eq("sesh_id", sesh);
      const theirs = await stranger.db.from("invite_claims").select("member_id").eq("sesh_id", sesh);

      expect(mine.data).toHaveLength(1);
      expect(mine.data![0].member_id).toBe(claimer.id);
      expect(theirs.data).toEqual([]);
    });

    /** There is NO write path for a member. Minting, revoking and redeeming
     *  are the three functions, and nothing else. */
    it("refuses a member writing an invite directly, and allows service_role", async () => {
      const sesh = await makeSesh();

      const asHost = await host.db
        .from("invites")
        .insert({ sesh_id: sesh, created_by: host.id, token_hash: freshHash(), expires_at: hoursFromNow(5) });
      const asService = await service
        .from("invites")
        .insert({ sesh_id: sesh, created_by: host.id, token_hash: freshHash(), expires_at: hoursFromNow(5) });

      expect(asHost.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });

    it("refuses a member writing a claim directly, and allows service_role", async () => {
      const sesh = await makeSesh();
      const { id } = await mustMint(sesh);

      const asMember = await claimer.db
        .from("invite_claims")
        .insert({ invite_id: id, member_id: claimer.id, sesh_id: sesh });
      const asService = await service
        .from("invite_claims")
        .insert({ invite_id: id, member_id: claimer.id, sesh_id: sesh });

      expect(asMember.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });

    /** A host cannot wind a use back, and a member cannot un-revoke a link. */
    it("refuses a member updating an invite, and allows service_role", async () => {
      const sesh = await makeSesh();
      const { id } = await mustMint(sesh, 5);
      await revoke(host, id);

      const asHost = await host.db.from("invites").update({ revoked_at: null, use_count: 0 }).eq("id", id);
      const afterHost = await inviteRow(id);
      const asService = await service.from("invites").update({ use_count: 3 }).eq("id", id);
      const afterService = await inviteRow(id);

      expect(asHost.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(afterHost.revoked_at).not.toBeNull();
      expect(asService.error).toBeNull();
      expect(afterService.use_count).toBe(3);
    });

    it("refuses a member deleting a claim, and allows service_role", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      const asClaimer = await claimer.db.from("invite_claims").delete().eq("sesh_id", sesh);
      const afterClaimer = await claimCount(sesh);
      const asService = await service.from("invite_claims").delete().eq("sesh_id", sesh);
      const afterService = await claimCount(sesh);

      expect(asClaimer.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(afterClaimer).toBe(1);
      expect(asService.error).toBeNull();
      expect(afterService).toBe(0);
    });

    /** A claim whose sesh disagrees with its invite is unwritable by the
     *  DATABASE, not by convention — that is what lets the policy and the
     *  visibility helper read sesh_id off the claim and trust it. */
    it("refuses a claim whose sesh does not match its invite, even for service_role", async () => {
      const sesh = await makeSesh();
      const elsewhere = await makeSesh();
      const { id } = await mustMint(sesh);

      const { error } = await service
        .from("invite_claims")
        .insert({ invite_id: id, member_id: claimer.id, sesh_id: elsewhere });

      expect(error).not.toBeNull();
      expect(error!.code).toBe("23503");
    });

    it("refuses anything that is not a sha256 in hex, even for service_role", async () => {
      const sesh = await makeSesh();

      const { error } = await service
        .from("invites")
        .insert({ sesh_id: sesh, created_by: host.id, token_hash: "not-a-hash", expires_at: hoursFromNow(5) });

      expect(error?.code).toBe("23514");
    });

    /** Deleting a sesh takes its links and its claims with it. The seven-day
     *  reaper in #32 leans on this. */
    it("cascades invites and claims when the sesh goes", async () => {
      const sesh = await makeSesh();
      const { hash } = await mustMint(sesh);
      await redeem(claimer, hash);

      await service.from("seshes").delete().eq("id", sesh);
      created.length = 0;

      const links = await service.from("invites").select("id").eq("sesh_id", sesh);
      const claims = await service.from("invite_claims").select("invite_id").eq("sesh_id", sesh);

      expect(links.data).toEqual([]);
      expect(claims.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------

  describe("the functions are not callable by anon", () => {
    /** Postgres grants EXECUTE to PUBLIC by default, and "Automatically
     *  expose new tables" does not change that. Every one of these was
     *  revoked, and #31 WIDENED NOTHING. The signed-out invite page reads
     *  its preview through the service-role client on the server instead —
     *  see lib/sesh/invite-reads.ts. The anon key never gets to guess. */
    it("refuses every new function to the anon key", async () => {
      const anon = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });

      const calls = await Promise.all([
        anon.rpc("mint_invite", {
          p_sesh: randomUUID(),
          p_token_hash: freshHash(),
          p_max_uses: 1,
          p_expires_at: hoursFromNow(5),
        }),
        anon.rpc("revoke_invite", { p_invite: randomUUID() }),
        anon.rpc("invite_preview", { p_token_hash: freshHash() }),
        anon.rpc("redeem_invite", { p_token_hash: freshHash() }),
      ]);

      for (const call of calls) expect(call.error).not.toBeNull();
    });
  });
});
