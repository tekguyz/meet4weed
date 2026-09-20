/** @vitest-environment node
 *
 *  The on-deck list, proved against the hosted project.
 *
 *  Every rule this file checks lives in Postgres — see
 *  supabase/migrations/…_contributions.sql. No screen, no server action and
 *  no client is consulted, so every claim below is a claim about the database
 *  and nothing else.
 *
 *  Security is proved DIFFERENTIALLY, as in sesh-address-unlock.test.ts: the
 *  same statement on the same row fails for a member and succeeds for
 *  service_role. No live rule is weakened anywhere to make a test go red.
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
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const TOO_MANY = "M4W18";
const TAMPA = { lat: 27.9506, lng: -82.4572 };

const COLUMNS = "id, sesh_id, member_id, kind, label, strain_type";

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe.skipIf(!configured)("the on-deck list", () => {
  let service: SupabaseClient;
  let host: Member;
  let guest: Member;
  let guest2: Member;
  let requester: Member;
  let denied: Member;
  let removed: Member;
  let withdrawn: Member;
  let stranger: Member;
  let admin: Member;

  /** One sesh carries the whole actor matrix, so nobody trips the twenty-
   *  requests-a-day cap in #7 while this file runs. */
  let shared: string;
  const extra: string[] = [];

  async function makeMember(tag: string): Promise<Member> {
    const email = `ondeck-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@meet4weed.test`;
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

  async function makeSesh(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "On-deck sesh",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 10,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    return data!.id as string;
  }

  async function makeExtraSesh(overrides: Record<string, unknown> = {}): Promise<string> {
    const id = await makeSesh(overrides);
    extra.push(id);
    return id;
  }

  const ask = (as: Member, sesh: string) => as.db.rpc("request_rsvp", { p_sesh: sesh });

  async function decide(sesh: string, member: Member, decision: string) {
    const { data } = await service.from("rsvps").select("id").eq("sesh_id", sesh).eq("member_id", member.id).single();
    const { error } = await host.db.rpc("decide_rsvp", { p_rsvp: data!.id, p_decision: decision });
    if (error) throw new Error(`decide failed: ${error.message}`);
  }

  /** An insert straight through PostgREST — the same path the server action
   *  takes, with the same grants and the same policies. */
  function add(as: Member, sesh: string, row: Record<string, unknown>) {
    return as.db
      .from("contributions")
      .insert({ sesh_id: sesh, member_id: as.id, ...row })
      .select(COLUMNS);
  }

  const addStrain = (as: Member, sesh: string, label: string, strainType = "hybrid") =>
    add(as, sesh, { kind: "strain", label, strain_type: strainType });

  const addItem = (as: Member, sesh: string, label: string) => add(as, sesh, { kind: "item", label });

  const addNone = (as: Member, sesh: string) => add(as, sesh, { kind: "none" });

  /** What this actor can read. An empty array is the locked state. */
  const listFor = async (as: Member, sesh: string) =>
    as.db.from("contributions").select(COLUMNS).eq("sesh_id", sesh);

  const listAsService = async (sesh: string) =>
    (await service.from("contributions").select(COLUMNS).eq("sesh_id", sesh)).data ?? [];

  const rowsOf = async (sesh: string, member: Member) =>
    (await service.from("contributions").select(COLUMNS).eq("sesh_id", sesh).eq("member_id", member.id)).data ?? [];

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });

    host = await makeMember("host");
    guest = await makeMember("guest");
    guest2 = await makeMember("guest2");
    requester = await makeMember("requester");
    denied = await makeMember("denied");
    removed = await makeMember("removed");
    withdrawn = await makeMember("withdrawn");
    stranger = await makeMember("stranger");
    admin = await makeMember("admin");

    const { error } = await service.from("admins").insert({ user_id: admin.id });
    if (error) throw new Error(`could not make an admin: ${error.message}`);

    shared = await makeSesh();

    await ask(guest, shared);
    await decide(shared, guest, "approved");
    await ask(guest2, shared);
    await decide(shared, guest2, "approved");
    await ask(requester, shared);
    await ask(denied, shared);
    await decide(shared, denied, "denied");
    await ask(removed, shared);
    await decide(shared, removed, "approved");
    await decide(shared, removed, "kicked");
    await ask(withdrawn, shared);
    await decide(shared, withdrawn, "approved");
    await withdrawn.db.rpc("cancel_rsvp", { p_sesh: shared });
  }, 180_000);

  afterEach(async () => {
    await service.from("contributions").delete().eq("sesh_id", shared);
    if (extra.length) await service.from("seshes").delete().in("id", extra);
    extra.length = 0;
  });

  afterAll(async () => {
    if (shared) await service.from("seshes").delete().eq("id", shared);
    if (admin?.id) await service.from("admins").delete().eq("user_id", admin.id);
    for (const m of [host, guest, guest2, requester, denied, removed, withdrawn, stranger, admin]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 180_000);

  describe("putting something on the list", () => {
    it("takes a strain with a name and a type from an approved guest", async () => {
      const { data, error } = await addStrain(guest, shared, "Blue Dream", "sativa");

      expect(error).toBeNull();
      expect(data![0]).toMatchObject({ kind: "strain", label: "Blue Dream", strain_type: "sativa" });
      expect(await listFor(guest, shared)).toMatchObject({ data: [{ label: "Blue Dream" }] });
    });

    it("takes an item with a label and no strain type", async () => {
      const { data, error } = await addItem(guest, shared, "Papers");

      expect(error).toBeNull();
      expect(data![0]).toMatchObject({ kind: "item", label: "Papers", strain_type: null });
    });

    it("takes several things from one person", async () => {
      await addStrain(guest, shared, "Blue Dream");
      await addItem(guest, shared, "Snacks");

      expect(await rowsOf(shared, guest)).toHaveLength(2);
    });

    it("takes the host's own contributions", async () => {
      const { error } = await addItem(host, shared, "Ice and cups");

      expect(error).toBeNull();
      expect(await rowsOf(shared, host)).toHaveLength(1);
    });

    it("shows one guest's row to another guest", async () => {
      await addStrain(guest, shared, "Blue Dream");

      const { data } = await listFor(guest2, shared);

      expect(data).toHaveLength(1);
      expect(data![0].member_id).toBe(guest.id);
    });
  });

  describe("the three states are exclusive, from both directions", () => {
    it("clears the real rows when somebody says they are bringing none", async () => {
      await addStrain(guest, shared, "Blue Dream");
      await addItem(guest, shared, "Snacks");

      await addNone(guest, shared);

      const rows = await rowsOf(shared, guest);
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("none");
    });

    it("clears the none row when somebody adds a real thing after all", async () => {
      await addNone(guest, shared);
      expect(await rowsOf(shared, guest)).toHaveLength(1);

      await addItem(guest, shared, "Papers");

      const rows = await rowsOf(shared, guest);
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("item");
    });

    it("never leaves somebody in both states, whichever order they went in", async () => {
      await addNone(guest, shared);
      await addStrain(guest, shared, "Blue Dream");
      await addNone(guest, shared);

      const kinds = (await rowsOf(shared, guest)).map((r) => r.kind);
      expect(kinds).toEqual(["none"]);
    });

    it("refuses a second none row for the same member on the same sesh", async () => {
      await addNone(guest, shared);

      const { error } = await addNone(guest, shared);

      expect(error?.code).toBe(UNIQUE_VIOLATION);
    });

    it("keeps the two members' answers apart", async () => {
      await addStrain(guest, shared, "Blue Dream");
      await addNone(guest2, shared);

      expect((await rowsOf(shared, guest)).map((r) => r.kind)).toEqual(["strain"]);
      expect((await rowsOf(shared, guest2)).map((r) => r.kind)).toEqual(["none"]);
    });
  });

  describe("the database refuses a row that is not one of the three shapes", () => {
    it("refuses a strain with no strain type", async () => {
      const { error } = await add(guest, shared, { kind: "strain", label: "Mystery" });

      expect(error?.code).toBe(CHECK_VIOLATION);
    });

    it("refuses a strain with no name", async () => {
      const { error } = await add(guest, shared, { kind: "strain", strain_type: "indica" });

      expect(error?.code).toBe(CHECK_VIOLATION);
    });

    it("refuses an item carrying a strain type", async () => {
      const { error } = await add(guest, shared, { kind: "item", label: "Papers", strain_type: "indica" });

      expect(error?.code).toBe(CHECK_VIOLATION);
    });

    it("refuses a none row carrying a label", async () => {
      const { error } = await add(guest, shared, { kind: "none", label: "nothing much" });

      expect(error?.code).toBe(CHECK_VIOLATION);
    });

    it("refuses a label that is only spaces, because a name of spaces is no name", async () => {
      const { error } = await add(guest, shared, { kind: "item", label: "    " });

      expect(error?.code).toBe(CHECK_VIOLATION);
    });
  });

  describe("the caps", () => {
    it("refuses an eleventh contribution on one sesh", async () => {
      for (let i = 0; i < 10; i += 1) {
        const { error } = await addItem(guest, shared, `Thing ${i}`);
        expect(error).toBeNull();
      }

      const { error } = await addItem(guest, shared, "Thing 11");

      expect(error?.code).toBe(TOO_MANY);
      expect(await rowsOf(shared, guest)).toHaveLength(10);
    });

    it("counts the cap per member, not per sesh", async () => {
      for (let i = 0; i < 10; i += 1) await addItem(guest, shared, `Thing ${i}`);

      const { error } = await addItem(guest2, shared, "Guest two's first");

      expect(error).toBeNull();
    });

    it("refuses a label longer than sixty characters after trimming", async () => {
      const { error } = await addItem(guest, shared, `  ${"x".repeat(61)}  `);

      expect(error?.code).toBe(CHECK_VIOLATION);
    });

    it("takes a label of exactly sixty characters once the spaces are trimmed off", async () => {
      const { data, error } = await addItem(guest, shared, `   ${"x".repeat(60)}   `);

      expect(error).toBeNull();
      expect(data![0].label).toBe("x".repeat(60));
    });

    it("refuses the same label twice from the same member, ignoring case", async () => {
      await addItem(guest, shared, "Papers");

      const { error } = await addItem(guest, shared, "PAPERS");

      expect(error?.code).toBe(UNIQUE_VIOLATION);
    });

    it("lets two different members bring the same thing", async () => {
      await addItem(guest, shared, "Papers");

      const { error } = await addItem(guest2, shared, "papers");

      expect(error).toBeNull();
    });
  });

  describe("who can read the list", () => {
    it("gives it to the host", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(host, shared)).data).toHaveLength(1);
    });

    it("gives it to an approved guest", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(guest2, shared)).data).toHaveLength(1);
    });

    /** Not an error and not a partial list. The locked card is rendered from
     *  this emptiness, so the screen decides nothing. */
    it("gives somebody who only asked an EMPTY RESULT, not an error", async () => {
      await addStrain(guest, shared, "Blue Dream");

      const { data, error } = await listFor(requester, shared);

      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(await listAsService(shared)).toHaveLength(1);
    });

    it("shows nothing to somebody who was declined", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(denied, shared)).data).toEqual([]);
    });

    it("shows nothing to somebody the host removed", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(removed, shared)).data).toEqual([]);
    });

    it("shows nothing to somebody who withdrew", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(withdrawn, shared)).data).toEqual([]);
    });

    it("shows nothing to a stranger", async () => {
      await addStrain(guest, shared, "Blue Dream");

      expect((await listFor(stranger, shared)).data).toEqual([]);
    });

    /** THERE IS NO ADMIN BRANCH. An exception nobody needed yet cannot be the
     *  exception that gets abused later. Proved differentially: the rows are
     *  really there, and the admin really cannot see them. */
    it("shows nothing to the app's own admin", async () => {
      await addStrain(guest, shared, "Blue Dream");

      const asAdmin = await listFor(admin, shared);

      expect(asAdmin.error).toBeNull();
      expect(asAdmin.data).toEqual([]);
      expect(await listAsService(shared)).toHaveLength(1);
    });
  });

  describe("editing and removing", () => {
    async function idOf(sesh: string, member: Member): Promise<string> {
      const rows = await rowsOf(sesh, member);
      return rows[0].id as string;
    }

    it("lets a guest edit their own row", async () => {
      await addStrain(guest, shared, "Blue Dream", "sativa");
      const id = await idOf(shared, guest);

      const { error } = await guest.db
        .from("contributions")
        .update({ label: "Blue Dream #2", strain_type: "hybrid" })
        .eq("id", id);

      expect(error).toBeNull();
      expect((await rowsOf(shared, guest))[0]).toMatchObject({ label: "Blue Dream #2", strain_type: "hybrid" });
    });

    it("lets a guest remove their own row", async () => {
      await addItem(guest, shared, "Papers");
      const id = await idOf(shared, guest);

      const { error } = await guest.db.from("contributions").delete().eq("id", id);

      expect(error).toBeNull();
      expect(await rowsOf(shared, guest)).toEqual([]);
    });

    it("refuses one guest editing another guest's row", async () => {
      await addItem(guest, shared, "Papers");
      const id = await idOf(shared, guest);

      // RLS hides the row from the update rather than raising, so the proof
      // is differential: the row did not move for the other guest, and the
      // same statement as service_role moved it.
      await guest2.db.from("contributions").update({ label: "Nothing" }).eq("id", id);
      expect((await rowsOf(shared, guest))[0].label).toBe("Papers");

      await service.from("contributions").update({ label: "Nothing" }).eq("id", id);
      expect((await rowsOf(shared, guest))[0].label).toBe("Nothing");
    });

    it("refuses one guest removing another guest's row", async () => {
      await addItem(guest, shared, "Papers");
      const id = await idOf(shared, guest);

      await guest2.db.from("contributions").delete().eq("id", id);
      expect(await rowsOf(shared, guest)).toHaveLength(1);

      await service.from("contributions").delete().eq("id", id);
      expect(await rowsOf(shared, guest)).toEqual([]);
    });

    /** The host's living room, so the host can take a row down. */
    it("lets the host delete any row on their own sesh", async () => {
      await addItem(guest, shared, "Papers");
      const id = await idOf(shared, guest);

      const { error } = await host.db.from("contributions").delete().eq("id", id);

      expect(error).toBeNull();
      expect(await rowsOf(shared, guest)).toEqual([]);
    });

    /** Removing a row is moderation. Rewriting one is putting words in a
     *  guest's mouth, and the host does not get that. */
    it("refuses the host EDITING somebody else's row", async () => {
      await addItem(guest, shared, "Papers");
      const id = await idOf(shared, guest);

      await host.db.from("contributions").update({ label: "Something else" }).eq("id", id);
      expect((await rowsOf(shared, guest))[0].label).toBe("Papers");

      await service.from("contributions").update({ label: "Something else" }).eq("id", id);
      expect((await rowsOf(shared, guest))[0].label).toBe("Something else");
    });
  });

  describe("the columns a member may name", () => {
    /** Column privileges are checked before RLS, so no policy bug can open
     *  this. An UPDATE naming a non-granted column fails WHOLE, even when the
     *  value does not change. */
    /** The value does not change, and it is refused anyway — that is the
     *  "an UPDATE naming a non-granted column fails WHOLE" rule in CLAUDE.md,
     *  and it is why the server actions send only label and strain_type. */
    it("refuses a member naming `kind` in an update, and lets service_role", async () => {
      await addItem(guest, shared, "Papers");
      const id = (await rowsOf(shared, guest))[0].id as string;

      const asGuest = await guest.db.from("contributions").update({ kind: "item" }).eq("id", id);
      const asService = await service.from("contributions").update({ kind: "item" }).eq("id", id);

      expect(asGuest.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });

    it("refuses a member naming `member_id` in an update, and lets service_role", async () => {
      await addItem(guest, shared, "Papers");
      const id = (await rowsOf(shared, guest))[0].id as string;

      const asGuest = await guest.db.from("contributions").update({ member_id: guest2.id }).eq("id", id);
      const asService = await service.from("contributions").update({ member_id: guest2.id }).eq("id", id);

      expect(asGuest.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });

    it("refuses a member writing a row in somebody else's name", async () => {
      const { error } = await guest.db
        .from("contributions")
        .insert({ sesh_id: shared, member_id: guest2.id, kind: "item", label: "Not mine" });

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(await rowsOf(shared, guest2)).toEqual([]);
    });
  });

  describe("who can write to the list", () => {
    it("refuses somebody who only asked", async () => {
      const { error } = await addItem(requester, shared, "Papers");

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });

    it("refuses a declined, a removed and a withdrawn member", async () => {
      for (const who of [denied, removed, withdrawn]) {
        const { error } = await addItem(who, shared, "Papers");
        expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      }
    });

    it("refuses a stranger", async () => {
      const { error } = await addItem(stranger, shared, "Papers");

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });

    it("refuses the app's own admin", async () => {
      const { error } = await addItem(admin, shared, "Papers");

      expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    });

    /** Verification is the gate after approval as well as before it — but it
     *  takes the WRITE, not the read. An expired member is read-only, here as
     *  everywhere else (spec §4.3). */
    it("lets a member whose card lapsed keep reading, and refuses every write", async () => {
      await addStrain(guest2, shared, "Blue Dream");
      await addItem(guest, shared, "Papers");
      const mine = (await rowsOf(shared, guest))[0].id as string;

      await service.from("profiles").update({ card_expires_on: isoDay(-3) }).eq("id", guest.id);

      const read = await listFor(guest, shared);
      const insert = await addItem(guest, shared, "Snacks");
      const update = await guest.db.from("contributions").update({ label: "Rizla" }).eq("id", mine);
      const remove = await guest.db.from("contributions").delete().eq("id", mine);

      await service.from("profiles").update({ card_expires_on: isoDay(200) }).eq("id", guest.id);

      expect(read.data).toHaveLength(2);
      expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      // An update and a delete refused by RLS remove no row rather than
      // raising, so the proof is that the row is untouched and still there.
      expect(update.error).toBeNull();
      expect(remove.error).toBeNull();
      expect((await rowsOf(shared, guest))[0].label).toBe("Papers");
    });
  });

  describe("when the list freezes", () => {
    it("refuses writes once the host cancels the sesh", async () => {
      const sesh = await makeExtraSesh();
      await ask(guest, sesh);
      await decide(sesh, guest, "approved");
      await addItem(guest, sesh, "Papers");
      const id = (await rowsOf(sesh, guest))[0].id as string;

      await service.from("seshes").update({ status: "cancelled" }).eq("id", sesh);

      const insert = await addItem(guest, sesh, "Snacks");
      await guest.db.from("contributions").delete().eq("id", id);

      expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(await rowsOf(sesh, guest)).toHaveLength(1);
      // Reading is not frozen: the people who are coming keep seeing it.
      expect((await listFor(guest, sesh)).data).toHaveLength(1);
    });

    it("refuses writes once the sesh has started", async () => {
      const sesh = await makeExtraSesh();
      await ask(guest, sesh);
      await decide(sesh, guest, "approved");
      await addItem(guest, sesh, "Papers");
      const id = (await rowsOf(sesh, guest))[0].id as string;

      await service.from("seshes").update({ starts_at: hoursFromNow(-1) }).eq("id", sesh);

      const insert = await addItem(guest, sesh, "Snacks");
      await guest.db.from("contributions").delete().eq("id", id);
      const asHost = await host.db.from("contributions").delete().eq("id", id);

      expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asHost.error).toBeNull();
      expect(await rowsOf(sesh, guest)).toHaveLength(1);
    });
  });

  describe("losing `approved` takes your rows with you", () => {
    async function seshWithRows(who: Member): Promise<string> {
      const sesh = await makeExtraSesh();
      await ask(who, sesh);
      await decide(sesh, who, "approved");
      await addStrain(who, sesh, "Blue Dream");
      await addItem(who, sesh, "Papers");
      expect(await rowsOf(sesh, who)).toHaveLength(2);
      return sesh;
    }

    it("deletes them when the host declines somebody", async () => {
      const sesh = await seshWithRows(denied);

      await decide(sesh, denied, "denied");

      expect(await rowsOf(sesh, denied)).toEqual([]);
    });

    it("deletes them when the host removes somebody", async () => {
      const sesh = await seshWithRows(removed);

      await decide(sesh, removed, "kicked");

      expect(await rowsOf(sesh, removed)).toEqual([]);
    });

    it("deletes them when somebody withdraws", async () => {
      const sesh = await seshWithRows(withdrawn);

      await withdrawn.db.rpc("cancel_rsvp", { p_sesh: sesh });

      expect(await rowsOf(sesh, withdrawn)).toEqual([]);
    });

    /** The RSVP row itself going away is the same event as losing `approved`,
     *  and a service-side tidy-up must not leave an orphan behind — nor
     *  explode on a NEW record that a DELETE trigger does not have. */
    it("deletes them when the RSVP row itself is deleted", async () => {
      const sesh = await seshWithRows(guest);

      const { error } = await service.from("rsvps").delete().eq("sesh_id", sesh).eq("member_id", guest.id);

      expect(error).toBeNull();
      expect(await rowsOf(sesh, guest)).toEqual([]);
    });

    it("leaves everybody else's rows alone", async () => {
      const sesh = await makeExtraSesh();
      await ask(guest, sesh);
      await decide(sesh, guest, "approved");
      await ask(withdrawn, sesh);
      await decide(sesh, withdrawn, "approved");
      await addItem(guest, sesh, "Papers");
      await addItem(withdrawn, sesh, "Snacks");

      await withdrawn.db.rpc("cancel_rsvp", { p_sesh: sesh });

      expect(await rowsOf(sesh, withdrawn)).toEqual([]);
      expect(await rowsOf(sesh, guest)).toHaveLength(1);
    });
  });
});
