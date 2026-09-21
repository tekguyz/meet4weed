/** @vitest-environment node
 *
 *  Plan 04, ticket #28 — unlisted seshes.
 *
 *  The claim under test is one sentence: an unlisted sesh is absent from the
 *  feed, the map and search, and is readable only by its host and by anyone
 *  holding a live RSVP on it.
 *
 *  The feed, the map and the search are proved here by running THEIR OWN
 *  shapes — the same `where` clauses lib/sesh/queries.ts sends — against the
 *  real project. Nothing in this file adds a visibility filter to those
 *  queries, because nothing in the app does either: if the exclusion stopped
 *  coming from the seshes_select policy, these tests would go red.
 *
 *  Every security claim is proved DIFFERENTIALLY: the same statement on the
 *  same row fails for a member and succeeds for service_role. No live rule is
 *  ever weakened to make a test go red.
 *
 *  Skipped without SUPABASE_SECRET_KEY, so CI never runs it.
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
/** "This sesh is not taking requests" — one code for every reason, so the
 *  function cannot be used to test whether an id exists. */
const NOT_TAKING_REQUESTS = "M4W11";

const TAMPA = { lat: 27.9506, lng: -82.4572 };

/** A word no other test fixture uses, so the search probe can find exactly
 *  the rows this file made and nothing else in the project. */
const MARKER = `unlistedprobe${Date.now()}`;

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe.skipIf(!configured)("unlisted seshes", () => {
  let service: SupabaseClient;
  let host: Member;
  let guest: Member;
  let stranger: Member;
  const created: string[] = [];

  async function makeMember(tag: string): Promise<Member> {
    const email = `unlisted-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: isoDay(200), attested_at: new Date().toISOString() })
      .eq("id", data.user.id);

    return { id: data.user.id, db };
  }

  /** Created through the host's own session, so the column grants and the
   *  insert policy are on the path — never a service_role shortcut. */
  async function create(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await host.db
      .from("seshes")
      .insert({
        host_id: host.id,
        title: `Probe ${MARKER}`,
        description: `A sesh tagged ${MARKER}`,
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
        gate_code: "1234",
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    created.push(data!.id as string);
    return data!.id as string;
  }

  const setVisibility = (as: Member, sesh: string, visibility: string) =>
    as.db.from("seshes").update({ visibility }).eq("id", sesh);

  const visibilityOf = async (sesh: string) =>
    (await service.from("seshes").select("visibility").eq("id", sesh).single()).data!.visibility;

  /** Setup, never the thing under test. A row policy refuses an UPDATE by
   *  matching no rows, not by raising, so a setup step can be a silent no-op
   *  — and every test after it would then pass for the wrong reason. This
   *  reads the value back and refuses to carry on if it did not move. */
  async function mustSetVisibility(as: Member, sesh: string, visibility: string) {
    const { error } = await setVisibility(as, sesh, visibility);
    if (error) throw new Error(`could not set visibility: ${error.message}`);
    const now = await visibilityOf(sesh);
    if (now !== visibility) throw new Error(`visibility stayed ${now}, wanted ${visibility}`);
  }

  const ask = (as: Member, sesh: string) => as.db.rpc("request_rsvp", { p_sesh: sesh });

  /** Same reason as mustSetVisibility. */
  async function mustAsk(as: Member, sesh: string) {
    const { error } = await ask(as, sesh);
    if (error) throw new Error(`could not ask for a seat: ${error.message}`);
  }

  async function decide(as: Member, sesh: string, member: string, decision: string) {
    const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh).eq("member_id", member).single();
    const { error } = await as.db.rpc("decide_rsvp", { p_rsvp: data!.id as string, p_decision: decision });
    if (error) throw new Error(`could not ${decision}: ${error.message}`);
  }

  const approve = (as: Member, sesh: string, member: string) => decide(as, sesh, member, "approved");
  const deny = (as: Member, sesh: string, member: string) => decide(as, sesh, member, "denied");

  /** The list columns lib/sesh/queries.ts asks for. Naming a private address
   *  column here would fail the whole query with 42501, which is the point of
   *  never using `select *`. */
  const LIST = "id, title, status, visibility, starts_at";

  /** listFeed's shape, exactly: open, not started, soonest first. No
   *  visibility filter, here or in the app. */
  const feed = (as: Member) =>
    as.db
      .from("seshes")
      .select(LIST)
      .eq("status", "open")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

  /** The map reads the same rows; only the page size differs. */
  const map = feed;

  /** listFeed with a search term. The marker is in the title and the
   *  description, both of which feed search_vector. */
  const search = (as: Member) =>
    feed(as).textSearch("search_vector", MARKER, { type: "websearch", config: "english" });

  const idsFrom = (rows: unknown[] | null) =>
    (rows ?? []).map((row) => (row as Record<string, unknown>).id as string);

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host");
    guest = await makeMember("guest");
    stranger = await makeMember("stranger");
  }, 90_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    for (const m of [host, guest, stranger]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 90_000);

  describe("the column", () => {
    /** The migration is additive. A row written without naming the column —
     *  which is every row that existed before it ran — is listed, and listed
     *  is what a sesh has always been. */
    it("makes a sesh listed when nobody says otherwise", async () => {
      const sesh = await create();

      const { data } = await service.from("seshes").select("visibility").eq("id", sesh).single();

      expect(data!.visibility).toBe("listed");
    });

    it("lets a host post an unlisted sesh outright", async () => {
      const sesh = await create({ visibility: "unlisted" });

      const { data } = await service.from("seshes").select("visibility").eq("id", sesh).single();

      expect(data!.visibility).toBe("unlisted");
    });

    /** Differential: the same column, the same row. A member may set their
     *  own sesh's visibility — that is the feature — but only their own. */
    it("refuses a member setting it on somebody else's sesh, and allows service_role", async () => {
      const sesh = await create();

      // The refusal is proved by reading the row back BEFORE service_role
      // touches it. A PostgREST update without .select() answers with no rows
      // whether it wrote or was refused, so the returned payload proves
      // nothing on its own.
      const asStranger = await setVisibility(stranger, sesh, "unlisted");
      const afterStranger = await visibilityOf(sesh);

      const asService = await service.from("seshes").update({ visibility: "unlisted" }).eq("id", sesh);
      const afterService = await visibilityOf(sesh);

      expect(asStranger.error).toBeNull();
      expect(afterStranger).toBe("listed");
      expect(asService.error).toBeNull();
      expect(afterService).toBe("unlisted");
    });
  });

  describe("a stranger", () => {
    it("does not find an unlisted sesh in the feed", async () => {
      const listed = await create();
      const unlisted = await create({ visibility: "unlisted" });

      const { data } = await feed(stranger);

      expect(idsFrom(data)).toContain(listed);
      expect(idsFrom(data)).not.toContain(unlisted);
    });

    it("does not find it on the map", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const { data } = await map(stranger);

      expect(idsFrom(data)).not.toContain(unlisted);
    });

    it("does not find it by searching for words that are in it", async () => {
      const listed = await create();
      const unlisted = await create({ visibility: "unlisted" });

      const { data } = await search(stranger);

      expect(idsFrom(data)).toContain(listed);
      expect(idsFrom(data)).not.toContain(unlisted);
    });

    /** Differential. Knowing the id is not permission: the policy answers an
     *  unlisted sesh with no rows, and service_role reads the same row fine,
     *  so the row plainly exists. */
    it("cannot read it by id, though service_role can", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const asMember = await stranger.db.from("seshes").select(LIST).eq("id", unlisted).maybeSingle();
      const asService = await service.from("seshes").select(LIST).eq("id", unlisted).maybeSingle();

      expect(asMember.error).toBeNull();
      expect(asMember.data).toBeNull();
      expect(asService.data).not.toBeNull();
    });

    /** private.has_rsvp is a read branch, so minting an RSVP would be a way
     *  in. public.request_rsvp is SECURITY DEFINER and does not run the
     *  policy, so it carries the rule itself. */
    it("cannot ask for a seat on it, which would otherwise let them read it", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const { error } = await ask(stranger, unlisted);

      expect(error?.code).toBe(NOT_TAKING_REQUESTS);
      const after = await stranger.db.from("seshes").select(LIST).eq("id", unlisted).maybeSingle();
      expect(after.data).toBeNull();
    });

    /** The one the host would never have seen. A denied member keeps their
     *  ROW, and the row was the only thing the door checked — so asking again
     *  set them back to `requested`, and `requested` is a read branch. The
     *  host denied them and then made the sesh private, and they let
     *  themselves back in. */
    it("cannot ask again after being denied, once the host unlists it", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      await deny(host, sesh, guest.id);
      await mustSetVisibility(host, sesh, "unlisted");

      const { error } = await ask(guest, sesh);

      expect(error?.code).toBe(NOT_TAKING_REQUESTS);
      const after = await guest.db.from("seshes").select(LIST).eq("id", sesh).maybeSingle();
      expect(after.data).toBeNull();
      const row = await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", guest.id).single();
      expect(row.data!.status).toBe("denied");
    });

    /** Somebody who WITHDREW is a different person to somebody who was
     *  refused. The host never turned them away, and they were on the guest
     *  list when the sesh was made private. */
    it("can ask again after withdrawing, because the host never refused them", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      const withdrawn = await guest.db.rpc("cancel_rsvp", { p_sesh: sesh });
      expect(withdrawn.error).toBeNull();
      await mustSetVisibility(host, sesh, "unlisted");

      const { error } = await ask(guest, sesh);

      expect(error).toBeNull();
    });

    /** Unchanged from Plan 03, and stated here so the tightening above cannot
     *  quietly spread to a listed sesh. A denied member can read a listed
     *  sesh through the public branch anyway, so re-asking gains them
     *  nothing and there is nothing to shut. */
    it("can still ask again after being denied on a listed sesh", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      await deny(host, sesh, guest.id);

      const { error } = await ask(guest, sesh);

      expect(error).toBeNull();
    });

    it("can still ask for a seat on a listed one", async () => {
      const listed = await create();

      const { error } = await ask(stranger, listed);

      expect(error).toBeNull();
    });
  });

  describe("the host", () => {
    it("still reads their own unlisted sesh", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const { data } = await host.db.from("seshes").select(LIST).eq("id", unlisted).maybeSingle();

      expect(data).not.toBeNull();
    });

    it("still reads its address", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const { data } = await host.db.rpc("sesh_address", { p_sesh: unlisted });

      expect((data as Record<string, unknown>[])[0].address_line).toBe("1 Test Street");
    });

    it("still edits it", async () => {
      const unlisted = await create({ visibility: "unlisted" });

      const { error } = await host.db.from("seshes").update({ title: "Renamed" }).eq("id", unlisted);

      expect(error).toBeNull();
      const { data } = await service.from("seshes").select("title").eq("id", unlisted).single();
      expect(data!.title).toBe("Renamed");
    });
  });

  describe("somebody already coming", () => {
    it("keeps seeing the sesh after the host unlists it", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      await approve(host, sesh, guest.id);

      await mustSetVisibility(host, sesh, "unlisted");

      const { data } = await guest.db.from("seshes").select(LIST).eq("id", sesh).maybeSingle();
      expect(data).not.toBeNull();
      expect((data as Record<string, unknown>).visibility).toBe("unlisted");
    });

    it("keeps their seat, so unlisting evicts nobody", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      await approve(host, sesh, guest.id);

      await mustSetVisibility(host, sesh, "unlisted");

      const { data } = await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", guest.id).single();
      expect(data!.status).toBe("approved");
    });

    it("keeps the address, which is a different rule and is not touched here", async () => {
      const sesh = await create({ starts_at: hoursFromNow(2) });
      await mustAsk(guest, sesh);
      await approve(host, sesh, guest.id);

      await mustSetVisibility(host, sesh, "unlisted");

      const { data } = await guest.db.rpc("sesh_address", { p_sesh: sesh });
      expect((data as Record<string, unknown>[])[0].address_line).toBe("1 Test Street");
    });

    /** Somebody who only asked, and has not been approved, is still holding a
     *  live RSVP. They were reading the sesh before; unlisting does not take
     *  that back. */
    it("keeps seeing it while still waiting on the host", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);

      await mustSetVisibility(host, sesh, "unlisted");

      const { data } = await guest.db.from("seshes").select(LIST).eq("id", sesh).maybeSingle();
      expect(data).not.toBeNull();
    });
  });

  describe("flipping back", () => {
    it("returns the sesh to the feed", async () => {
      const sesh = await create({ visibility: "unlisted" });
      const before = await feed(stranger);
      expect(idsFrom(before.data)).not.toContain(sesh);

      await mustSetVisibility(host, sesh, "listed");

      const after = await feed(stranger);
      expect(idsFrom(after.data)).toContain(sesh);
    });

    it("admits nobody who was not already there, and drops nobody who was", async () => {
      const sesh = await create();
      await mustAsk(guest, sesh);
      await approve(host, sesh, guest.id);

      await mustSetVisibility(host, sesh, "unlisted");
      await mustSetVisibility(host, sesh, "listed");

      const seat = await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", guest.id).single();
      expect(seat.data!.status).toBe("approved");
      const { count } = await service.from("rsvps").select("id", { count: "exact", head: true }).eq("sesh_id", sesh);
      expect(count).toBe(1);
    });
  });

  describe("the rest of the rules, on an unlisted sesh", () => {
    /** Differential, on a row the member is allowed to read. Being able to
     *  see that a sesh exists has never been permission to read its address,
     *  and unlisted does not change that either way. */
    it("still refuses a member naming a private address column, and allows service_role", async () => {
      // Listed first, so the guest can get in at all — the door is shut on an
      // unlisted sesh, which the stranger tests above prove. Then unlisted,
      // which is the state this test is about.
      const sesh = await create();
      await mustAsk(guest, sesh);
      await mustSetVisibility(host, sesh, "unlisted");

      const readable = await guest.db.from("seshes").select("id").eq("id", sesh).maybeSingle();
      const asMember = await guest.db.from("seshes").select("address_line").eq("id", sesh);
      const asService = await service.from("seshes").select("address_line").eq("id", sesh);

      expect(readable.data).not.toBeNull();
      expect(asMember.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
      expect(asService.data![0].address_line).toBe("1 Test Street");
    });

    /** private.open_sesh_count counts by host, status and start time. It does
     *  not read visibility, and must not: unlisting would otherwise be a way
     *  to host an unlimited number of seshes. */
    it("still counts against the host's five open seshes", async () => {
      for (let i = 0; i < 5; i += 1) await create({ visibility: "unlisted" });

      const sixth = await host.db
        .from("seshes")
        .insert({
          host_id: host.id,
          title: `Sixth ${MARKER}`,
          sesh_type: "chill",
          starts_at: hoursFromNow(72),
          capacity: 6,
          exact_lat: TAMPA.lat,
          exact_lng: TAMPA.lng,
          address_line: "1 Test Street",
        })
        .select("id")
        .single();

      expect(sixth.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    }, 30_000);
  });
});
