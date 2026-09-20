/** @vitest-environment node
 *
 *  Who may read a sesh, who may write one, and — the part that matters — who
 *  may read the address. Tested through PostgREST against the real project,
 *  the same way as profiles-rls.test.ts. Skipped without the service key.
 *
 *  Every security claim here is proved DIFFERENTIALLY: the same statement on
 *  the same row fails for a member and succeeds for service_role. No live rule
 *  is ever weakened to make a test go red.
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

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe.skipIf(!configured)("sesh row-level security", () => {
  let service: SupabaseClient;
  let host: Member;
  let stranger: Member;
  let expired: Member;
  let unverified: Member;
  const created: string[] = [];

  async function makeMember(tag: string, status: "verified" | "expired" | "unverified"): Promise<Member> {
    const email = `seshrls-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    if (status !== "unverified") {
      await service
        .from("profiles")
        .update({
          status,
          // An expired member keeps a date in the past; that is what
          // private.is_active_member reads, so it never trusts the sweep.
          card_expires_on: status === "verified" ? isoDay(200) : isoDay(-10),
          attested_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    }
    return { id: data.user.id, db };
  }

  /** Created through the member's own session, so the column grants and the
   *  insert policy are on the path — never a service_role shortcut. */
  async function create(as: Member, overrides: Record<string, unknown> = {}) {
    const result = await as.db
      .from("seshes")
      .insert({
        host_id: as.id,
        title: "Test sesh",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
        unit_note: "Apt 4",
        gate_code: "1234",
        ...overrides,
      })
      .select("id")
      .single();
    if (result.data) created.push(result.data.id as string);
    return result;
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host", "verified");
    stranger = await makeMember("stranger", "verified");
    expired = await makeMember("expired", "expired");
    unverified = await makeMember("unverified", "unverified");
  }, 90_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    for (const m of [host, stranger, expired, unverified]) {
      if (m?.id) await service.auth.admin.deleteUser(m.id);
    }
  }, 90_000);

  describe("the address columns", () => {
    it("cannot be named in a query by the host who wrote them, but can by service_role", async () => {
      const { data: sesh } = await create(host);

      const asMember = await host.db.from("seshes").select("address_line").eq("id", sesh!.id);
      const asService = await service.from("seshes").select("address_line").eq("id", sesh!.id);

      expect(asMember.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
      expect(asService.data![0].address_line).toBe("1 Test Street");
    });

    /** A wildcard does not quietly drop the columns the member cannot read —
     *  it fails the whole statement, the same way an UPDATE naming a
     *  non-granted column does. This is why lib/sesh/queries.ts names its
     *  columns: `*` is not a leak here, it is an outage. */
    it("makes a wildcard query fail outright rather than silently trimming it", async () => {
      const { data: sesh } = await create(host);

      const asMember = await host.db.from("seshes").select("*").eq("id", sesh!.id);
      const asService = await service.from("seshes").select("*").eq("id", sesh!.id);

      expect(asMember.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.data).toHaveLength(1);
    });

    it("cannot be read by a stranger through sesh_address", async () => {
      const { data: sesh } = await create(host);

      const { data } = await stranger.db.rpc("sesh_address", { p_sesh: sesh!.id });

      expect(data).toEqual([]);
    });
  });

  describe("sesh_address, host branch", () => {
    it("gives the host their own street, unit and gate code", async () => {
      const { data: sesh } = await create(host);

      const { data } = await host.db.rpc("sesh_address", { p_sesh: sesh!.id });

      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ address_line: "1 Test Street", unit_note: "Apt 4", gate_code: "1234" });
    });

    it("still gives it to the host after they cancel, so the edit screen can load", async () => {
      const { data: sesh } = await create(host);
      await host.db.from("seshes").update({ status: "cancelled" }).eq("id", sesh!.id);

      const { data } = await host.db.rpc("sesh_address", { p_sesh: sesh!.id });

      expect(data).toHaveLength(1);
    });

    it("still gives it to the host long after the sesh has started", async () => {
      const { data: sesh } = await create(host, { starts_at: hoursFromNow(-72) });

      const { data } = await host.db.rpc("sesh_address", { p_sesh: sesh!.id });

      expect(data).toHaveLength(1);
    });
  });

  describe("the fuzzy circle", () => {
    it("cannot be written by the host, but can be read", async () => {
      const { data: sesh } = await create(host);

      const write = await host.db.from("seshes").update({ fuzzy_lat: 0 }).eq("id", sesh!.id);
      const read = await host.db.from("seshes").select("fuzzy_lat").eq("id", sesh!.id).single();

      expect(write.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(read.data!.fuzzy_lat).not.toBeNull();
    });
  });

  describe("hosting", () => {
    it("refuses a sixth open future sesh, and cancelling frees the slot", async () => {
      for (let i = 0; i < 5; i++) expect((await create(host, { title: `Sesh ${i}` })).error).toBeNull();

      const sixth = await create(host, { title: "One too many" });
      await host.db.from("seshes").update({ status: "cancelled" }).eq("id", created[0]);
      const afterCancelling = await create(host, { title: "Back under the cap" });

      expect(sixth.error).not.toBeNull();
      expect(afterCancelling.error).toBeNull();
    });

    it("refuses a member whose card has expired, and allows the same insert for service_role", async () => {
      const asExpiredMember = await create(expired);
      const asService = await service.from("seshes").insert({
        host_id: expired.id,
        title: "Service can still write",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
      }).select("id").single();
      if (asService.data) created.push(asService.data.id as string);

      expect(asExpiredMember.error).not.toBeNull();
      expect(asService.error).toBeNull();
    });

    it("refuses a member hosting under somebody else's name", async () => {
      const { error } = await stranger.db.from("seshes").insert({
        host_id: host.id,
        title: "Not mine to post",
        sesh_type: "chill",
        starts_at: hoursFromNow(48),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
      });

      expect(error).not.toBeNull();
    });
  });

  describe("the area name", () => {
    it("is written by the host and readable by anybody browsing", async () => {
      const { data: sesh } = await create(host);

      const write = await host.db.from("seshes").update({ area_name: "Riverside" }).eq("id", sesh!.id);
      const { data } = await stranger.db.from("seshes").select("area_name").eq("id", sesh!.id).single();

      expect(write.error).toBeNull();
      expect(data!.area_name).toBe("Riverside");
    });

    /** The column is the backstop for a host pasting their street into a
     *  public field. The form warns; this refuses. */
    it("refuses a name long enough to hide a street address in", async () => {
      const { data: sesh } = await create(host);

      const { error } = await host.db
        .from("seshes")
        .update({ area_name: "1600 Pennsylvania Avenue Northwest, Washington" })
        .eq("id", sesh!.id);

      expect(error).not.toBeNull();
    });
  });

  describe("the host-changed stamp", () => {
    /** A sesh must not move under its guests in silence. The stamp is what
     *  the banner reads; what counts as "moved" is decided here, not by a
     *  screen. */
    it("is set when the pin moves more than a kilometre", async () => {
      const { data: sesh } = await create(host);

      // About 2.2 km north.
      await host.db.from("seshes").update({ exact_lat: TAMPA.lat + 0.02 }).eq("id", sesh!.id);

      const { data } = await service.from("seshes").select("materially_changed_at").eq("id", sesh!.id).single();
      expect(data!.materially_changed_at).not.toBeNull();
    });

    it("is left alone when the pin barely moves", async () => {
      const { data: sesh } = await create(host);

      // About 22 m.
      await host.db.from("seshes").update({ exact_lat: TAMPA.lat + 0.0002 }).eq("id", sesh!.id);

      const { data } = await service.from("seshes").select("materially_changed_at").eq("id", sesh!.id).single();
      expect(data!.materially_changed_at).toBeNull();
    });

    it("is set when the start time moves more than an hour", async () => {
      const { data: sesh } = await create(host);

      await host.db.from("seshes").update({ starts_at: hoursFromNow(52) }).eq("id", sesh!.id);

      const { data } = await service.from("seshes").select("materially_changed_at").eq("id", sesh!.id).single();
      expect(data!.materially_changed_at).not.toBeNull();
    });

    it("is left alone when the start time shifts by half an hour", async () => {
      const { data: sesh } = await create(host);

      await host.db.from("seshes").update({ starts_at: hoursFromNow(48.5) }).eq("id", sesh!.id);

      const { data } = await service.from("seshes").select("materially_changed_at").eq("id", sesh!.id).single();
      expect(data!.materially_changed_at).toBeNull();
    });

    /** Otherwise the banner cries wolf and people stop reading it. */
    it("is left alone by a typo fix", async () => {
      const { data: sesh } = await create(host);

      await host.db
        .from("seshes")
        .update({ title: "Renamed", description: "New words", capacity: 4, sesh_type: "outdoors" })
        .eq("id", sesh!.id);

      const { data } = await service.from("seshes").select("materially_changed_at").eq("id", sesh!.id).single();
      expect(data!.materially_changed_at).toBeNull();
    });

    it("cannot be written by the host, but can by service_role", async () => {
      const { data: sesh } = await create(host);
      const now = new Date().toISOString();

      const asHost = await host.db.from("seshes").update({ materially_changed_at: now }).eq("id", sesh!.id);
      const asService = await service.from("seshes").update({ materially_changed_at: now }).eq("id", sesh!.id);

      expect(asHost.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });
  });

  describe("browsing", () => {
    it("shows an open sesh to any verified member", async () => {
      const { data: sesh } = await create(host);

      const { data } = await stranger.db.from("seshes").select("id").eq("id", sesh!.id);

      expect(data).toHaveLength(1);
    });

    it("shows nothing at all to an unverified member", async () => {
      const { data: sesh } = await create(host);

      const { data } = await unverified.db.from("seshes").select("id").eq("id", sesh!.id);

      expect(data).toEqual([]);
    });

    it("lets an expired member read but refuses every write", async () => {
      const { data: sesh } = await create(host);

      const read = await expired.db.from("seshes").select("id").eq("id", sesh!.id);
      const write = await expired.db.from("seshes").update({ title: "Hijacked" }).eq("id", sesh!.id);

      expect(read.data).toHaveLength(1);
      expect(write.data).toBeNull();
      const { data: unchanged } = await service.from("seshes").select("title").eq("id", sesh!.id).single();
      expect(unchanged!.title).toBe("Test sesh");
    });

    it("hides a sesh from others once the host's card lapses, while the host still sees it", async () => {
      const { data: sesh } = await create(host);
      // At least two days back. private.florida_today() is a New York date, so
      // a run late in the UTC evening makes isoDay(-1) still valid today.
      await service.from("profiles").update({ card_expires_on: isoDay(-3) }).eq("id", host.id);

      const toStranger = await stranger.db.from("seshes").select("id").eq("id", sesh!.id);
      const toHost = await host.db.from("seshes").select("id").eq("id", sesh!.id);

      await service.from("profiles").update({ card_expires_on: isoDay(200) }).eq("id", host.id);

      expect(toStranger.data).toEqual([]);
      expect(toHost.data).toHaveLength(1);
    });
  });
});
