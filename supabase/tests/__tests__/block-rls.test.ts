/** @vitest-environment node
 *
 *  Issue #111 — the block wall, tested through PostgREST against the real
 *  project with each member's own session. Skipped without the service key.
 *
 *  A block is two-way: neither member reads the other's profile or the seshes
 *  the other hosts, and neither can ask to join the other's sesh, by asking or
 *  by invite link. The blocked member only ever sees the ordinary "not found"
 *  or "not taking requests" — never a new error.
 *
 *  Every refusal is proved DIFFERENTIALLY: the same statement fails across the
 *  wall and succeeds for a member on the near side of it (or for
 *  service_role). No live rule is weakened to make a test red.
 *
 *  Emails start with `it-` and end in @meet4weed.test, so a sweep after a red
 *  run can find exactly these and nothing else.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Block-probe-3e7b2d9a5c1f!";
const TAMPA = { lat: 27.9506, lng: -82.4572 };

const NOT_TAKING_REQUESTS = "M4W11";
const LINK_DOES_NOT_WORK = "M4W19";
const CANNOT_BLOCK = "M4W60";

type Member = { id: string; handle: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const freshHash = () => createHash("sha256").update(randomUUID()).digest("hex");
const session = () => createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!configured)("the block wall", () => {
  let service: SupabaseClient;
  const made: string[] = [];
  const seshes: string[] = [];

  let alice: Member; // the blocker
  let bob: Member; // the blocked
  let carol: Member; // a third member, hosting
  let dave: Member; // a bystander: the near side of every differential

  async function verify(id: string, patch: Record<string, unknown> = {}) {
    const { error } = await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: isoDay(200), attested_at: new Date().toISOString(), ...patch })
      .eq("id", id);
    if (error) throw new Error(`could not verify: ${error.message}`);
  }

  async function handleOf(id: string): Promise<string> {
    return (await service.from("profiles").select("handle").eq("id", id).single()).data!.handle as string;
  }

  async function makeMember(tag: string, patch: Record<string, unknown> = {}): Promise<Member> {
    const email = `it-block-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);
    const db = session();
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    await verify(data.user.id, patch);
    return { id: data.user.id, handle: await handleOf(data.user.id), db };
  }

  async function makeVisitor(): Promise<Member> {
    const db = session();
    const { data, error } = await db.auth.signInAnonymously();
    if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
    made.push(data.user.id);
    await verify(data.user.id, { is_demo: true });
    return { id: data.user.id, handle: await handleOf(data.user.id), db };
  }

  /** Setup through service_role. Hosting rules are proved in sesh-rls. */
  async function makeSesh(host: Member, overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Block probe",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Wall Street",
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    seshes.push(data!.id as string);
    return data!.id as string;
  }

  async function rsvp(sesh: string, member: Member, status = "approved") {
    const { error } = await service.from("rsvps").insert({ sesh_id: sesh, member_id: member.id, status });
    if (error) throw new Error(`rsvp insert failed: ${error.message}`);
  }

  const statusOf = async (sesh: string, member: Member) =>
    (await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", member.id).single()).data
      ?.status;

  const block = (as: Member, target: Member) => as.db.rpc("block_member", { p_member: target.id });
  const unblock = (as: Member, target: Member) => as.db.rpc("unblock_member", { p_member: target.id });

  async function mustBlock(as: Member, target: Member) {
    const { error } = await block(as, target);
    if (error) throw new Error(`block failed: ${error.message}`);
  }

  const seesProfile = async (as: Member, target: Member) =>
    ((await as.db.from("profiles").select("id").eq("id", target.id)).data ?? []).length === 1;

  const seesSesh = async (as: Member, sesh: string) =>
    ((await as.db.from("seshes").select("id").eq("id", sesh)).data ?? []).length === 1;

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    alice = await makeMember("alice");
    bob = await makeMember("bob");
    carol = await makeMember("carol");
    dave = await makeMember("dave");
  }, 180_000);

  afterEach(async () => {
    await service.from("blocks").delete().in("blocker_id", made);
    if (seshes.length) await service.from("seshes").delete().in("id", seshes);
    seshes.length = 0;
  });

  afterAll(async () => {
    for (const id of made) await service.auth.admin.deleteUser(id);
  }, 180_000);

  describe("the table", () => {
    it("refuses a member blocking themself", async () => {
      const { error } = await block(alice, alice);
      expect(error?.code).toBe(CANNOT_BLOCK);

      // The check constraint holds even for service_role.
      const { error: direct } = await service.from("blocks").insert({ blocker_id: alice.id, blocked_id: alice.id });
      expect(direct?.code).toBe("23514");
    });

    it("gives a member no way to write a block row directly", async () => {
      const { error } = await alice.db.from("blocks").insert({ blocker_id: alice.id, blocked_id: bob.id });
      expect(error).not.toBeNull();

      const { error: serviceError } = await service.from("blocks").insert({ blocker_id: alice.id, blocked_id: bob.id });
      expect(serviceError).toBeNull();
    });

    it("lets the blocker read their own row, and never the member they blocked", async () => {
      await mustBlock(alice, bob);

      const mine = await alice.db.from("blocks").select("blocked_id");
      expect(mine.data).toEqual([{ blocked_id: bob.id }]);

      const theirs = await bob.db.from("blocks").select("blocker_id");
      expect(theirs.data).toEqual([]);
    });

    it("is not an error to block twice", async () => {
      await mustBlock(alice, bob);
      const { error } = await block(alice, bob);
      expect(error).toBeNull();
    });
  });

  describe("profiles", () => {
    it("hides each from the other, in both directions, and from nobody else", async () => {
      expect(await seesProfile(bob, alice)).toBe(true);
      await mustBlock(alice, bob);

      expect(await seesProfile(alice, bob)).toBe(false);
      expect(await seesProfile(bob, alice)).toBe(false);
      expect(await seesProfile(dave, alice)).toBe(true);
      expect(await seesProfile(dave, bob)).toBe(true);
      // Your own row is always yours.
      expect(await seesProfile(bob, bob)).toBe(true);
    });

    it("hides a handle lookup the same way a missing handle is hidden", async () => {
      await mustBlock(alice, bob);
      const { data } = await bob.db.from("profiles").select("id").eq("handle", alice.handle).maybeSingle();
      expect(data).toBeNull();
    });

    it("comes back on unblock", async () => {
      await mustBlock(alice, bob);
      const { error } = await unblock(alice, bob);
      expect(error).toBeNull();
      expect(await seesProfile(bob, alice)).toBe(true);
      expect(await seesProfile(alice, bob)).toBe(true);
    });

    it("stays up when only the other member unblocks, because it is not theirs to lift", async () => {
      await mustBlock(alice, bob);
      await unblock(bob, alice);
      expect(await seesProfile(bob, alice)).toBe(false);
    });
  });

  describe("seshes", () => {
    it("hides a sesh the other hosts, in both directions", async () => {
      const aliceSesh = await makeSesh(alice);
      const bobSesh = await makeSesh(bob);
      expect(await seesSesh(bob, aliceSesh)).toBe(true);

      await mustBlock(alice, bob);

      expect(await seesSesh(bob, aliceSesh)).toBe(false);
      expect(await seesSesh(alice, bobSesh)).toBe(false);
      expect(await seesSesh(dave, aliceSesh)).toBe(true);
      expect(await seesSesh(alice, aliceSesh)).toBe(true);
    });

    it("hides the exact location of a sesh that has started, even with an approved seat", async () => {
      const started = await makeSesh(alice, { starts_at: hoursFromNow(-1) });
      await rsvp(started, bob);
      await rsvp(started, dave);

      await mustBlock(alice, bob);

      const address = (as: Member) => as.db.rpc("sesh_address", { p_sesh: started });
      expect(((await address(dave)).data ?? []).length).toBe(1);
      expect(((await address(bob)).data ?? []).length).toBe(0);
    });
  });

  describe("the RSVP door", () => {
    it("refuses a request across the wall with the ordinary 'not taking requests'", async () => {
      const aliceSesh = await makeSesh(alice);
      const bobSesh = await makeSesh(bob);
      await mustBlock(alice, bob);

      const bobAsks = await bob.db.rpc("request_rsvp", { p_sesh: aliceSesh });
      expect(bobAsks.error?.code).toBe(NOT_TAKING_REQUESTS);

      const aliceAsks = await alice.db.rpc("request_rsvp", { p_sesh: bobSesh });
      expect(aliceAsks.error?.code).toBe(NOT_TAKING_REQUESTS);

      const daveAsks = await dave.db.rpc("request_rsvp", { p_sesh: aliceSesh });
      expect(daveAsks.error).toBeNull();
    });

    it("refuses an invite link across the wall with the ordinary 'that link does not work'", async () => {
      const aliceSesh = await makeSesh(alice);
      const hash = freshHash();
      const { error: mintError } = await alice.db.rpc("mint_invite", {
        p_sesh: aliceSesh,
        p_token_hash: hash,
        p_max_uses: 5,
        p_expires_at: null,
      });
      if (mintError) throw new Error(`mint failed: ${mintError.message}`);

      await mustBlock(alice, bob);

      const bobRedeems = await bob.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(bobRedeems.error?.code).toBe(LINK_DOES_NOT_WORK);

      const daveRedeems = await dave.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(daveRedeems.error).toBeNull();
    });

    it("shows no invite preview across the wall", async () => {
      const aliceSesh = await makeSesh(alice);
      const hash = freshHash();
      await alice.db.rpc("mint_invite", { p_sesh: aliceSesh, p_token_hash: hash, p_max_uses: 5, p_expires_at: null });

      await mustBlock(alice, bob);

      const preview = async (as: Member) =>
        ((await as.db.rpc("invite_preview", { p_token_hash: hash })).data ?? []).length;
      expect(await preview(bob)).toBe(0);
      expect(await preview(dave)).toBe(1);
    });

    it("does not let a claim made before the block carry the member back in", async () => {
      const aliceSesh = await makeSesh(alice, { visibility: "unlisted" });
      const hash = freshHash();
      await alice.db.rpc("mint_invite", { p_sesh: aliceSesh, p_token_hash: hash, p_max_uses: 5, p_expires_at: null });
      const first = await bob.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(first.error).toBeNull();

      await mustBlock(alice, bob);

      const again = await bob.db.rpc("redeem_invite", { p_token_hash: hash });
      expect(again.error?.code).toBe(LINK_DOES_NOT_WORK);
      expect(await seesSesh(bob, aliceSesh)).toBe(false);
    });
  });

  describe("what a block ends", () => {
    it("kicks the blocker's upcoming guest and cancels the blocker's upcoming seat", async () => {
      const aliceHosts = await makeSesh(alice);
      const aliceHostsAsked = await makeSesh(alice);
      const bobHosts = await makeSesh(bob);
      await rsvp(aliceHosts, bob, "approved");
      await rsvp(aliceHostsAsked, bob, "requested");
      await rsvp(bobHosts, alice, "approved");
      await rsvp(aliceHosts, dave, "approved");

      await mustBlock(alice, bob);

      expect(await statusOf(aliceHosts, bob)).toBe("kicked");
      expect(await statusOf(aliceHostsAsked, bob)).toBe("kicked");
      expect(await statusOf(bobHosts, alice)).toBe("cancelled");
      // Nobody else on the list moves.
      expect(await statusOf(aliceHosts, dave)).toBe("approved");
    });

    it("leaves past seshes alone", async () => {
      const pastAlice = await makeSesh(alice, { starts_at: hoursFromNow(-30) });
      const pastBob = await makeSesh(bob, { starts_at: hoursFromNow(-30) });
      await rsvp(pastAlice, bob);
      await rsvp(pastBob, alice);

      await mustBlock(alice, bob);

      expect(await statusOf(pastAlice, bob)).toBe("approved");
      expect(await statusOf(pastBob, alice)).toBe("approved");
    });

    it("clears the kicked guest's bring list, as any kick does", async () => {
      const aliceHosts = await makeSesh(alice);
      await rsvp(aliceHosts, bob);
      const { error: bringError } = await bob.db
        .from("contributions")
        .insert({ sesh_id: aliceHosts, member_id: bob.id, kind: "item", label: "Ice" });
      if (bringError) throw new Error(`contribution failed: ${bringError.message}`);

      await mustBlock(alice, bob);

      const { data } = await service.from("contributions").select("id").eq("sesh_id", aliceHosts).eq("member_id", bob.id);
      expect(data).toEqual([]);
    });

    it("sends no notification", async () => {
      const aliceHosts = await makeSesh(alice);
      await rsvp(aliceHosts, bob);
      await mustBlock(alice, bob);

      const { data } = await service.from("notifications").select("id").in("recipient_id", [alice.id, bob.id]);
      expect(data).toEqual([]);
    });

    it("reopens nothing on unblock", async () => {
      const aliceHosts = await makeSesh(alice);
      await rsvp(aliceHosts, bob);
      await mustBlock(alice, bob);
      await unblock(alice, bob);

      expect(await statusOf(aliceHosts, bob)).toBe("kicked");
      expect(await seesSesh(bob, aliceHosts)).toBe(true);
    });
  });

  describe("a third member's sesh", () => {
    it("still shows both members on the guest list, with their handles", async () => {
      const carolHosts = await makeSesh(carol);
      await rsvp(carolHosts, alice);
      await rsvp(carolHosts, bob);

      await mustBlock(alice, bob);

      expect(await statusOf(carolHosts, alice)).toBe("approved");
      expect(await statusOf(carolHosts, bob)).toBe("approved");

      const list = async (as: Member) =>
        ((await as.db.from("rsvps").select("member_id, profiles(handle)").eq("sesh_id", carolHosts)).data ?? []).map(
          (r) => (r.profiles as unknown as { handle: string } | null)?.handle ?? null,
        );

      expect((await list(alice)).sort()).toEqual([alice.handle, bob.handle].sort());
      expect((await list(bob)).sort()).toEqual([alice.handle, bob.handle].sort());
      expect(await seesSesh(bob, carolHosts)).toBe(true);
    });

    it("closes that hole once the night is over", async () => {
      const carolLongAgo = await makeSesh(carol, { starts_at: hoursFromNow(-30) });
      await rsvp(carolLongAgo, alice);
      await rsvp(carolLongAgo, bob);

      await mustBlock(alice, bob);

      expect(await seesProfile(bob, alice)).toBe(false);
      expect(await seesProfile(alice, bob)).toBe(false);
    });
  });

  describe("realms", () => {
    it("refuses a block across the realms with the same code as any other refusal", async () => {
      const visitor = await makeVisitor();

      const fromVisitor = await block(visitor, alice);
      expect(fromVisitor.error?.code).toBe(CANNOT_BLOCK);

      const fromReal = await block(alice, visitor);
      expect(fromReal.error?.code).toBe(CANNOT_BLOCK);

      // Nor with service_role: the realm trigger holds.
      const direct = await service.from("blocks").insert({ blocker_id: alice.id, blocked_id: visitor.id });
      expect(direct.error?.code).toBe("42501");
    });

    it("lets a demo visitor block a cast member, for real, inside the demo realm", async () => {
      const visitor = await makeVisitor();
      const cast = await makeMember("cast", { is_demo: true });
      expect(await seesProfile(visitor, cast)).toBe(true);

      const { error } = await block(visitor, cast);
      expect(error).toBeNull();

      expect(await seesProfile(visitor, cast)).toBe(false);
      const row = await service.from("blocks").select("is_demo").eq("blocker_id", visitor.id).single();
      expect(row.data?.is_demo).toBe(true);
    });

    it("refuses a visitor blocking another visitor they cannot see", async () => {
      const one = await makeVisitor();
      const two = await makeVisitor();
      const { error } = await block(one, two);
      expect(error?.code).toBe(CANNOT_BLOCK);
    });
  });

  describe("the bell", () => {
    it("reads a notification's actor as nobody once the actor is behind the wall", async () => {
      const aliceHosts = await makeSesh(alice);
      const { error: insertError } = await service
        .from("notifications")
        .insert({ recipient_id: alice.id, type: "rsvp_requested", sesh_id: aliceHosts, actor_id: bob.id });
      if (insertError) throw new Error(`notification insert failed: ${insertError.message}`);

      // The same select lib/notify/queries.ts makes.
      const actor = async () =>
        (
          await alice.db
            .from("notifications")
            .select("actor:profiles!notifications_actor_id_fkey(handle)")
            .eq("recipient_id", alice.id)
            .single()
        ).data?.actor as unknown as { handle: string } | null;

      expect((await actor())?.handle).toBe(bob.handle);
      await mustBlock(alice, bob);
      expect(await actor()).toBeNull();

      await service.from("notifications").delete().eq("recipient_id", alice.id);
    });
  });
});
