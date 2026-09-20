/** @vitest-environment node
 *
 *  The feed: what search finds, what order things come back in, and the seat
 *  counter. Tested through PostgREST against the real project. Skipped
 *  without the service key.
 *
 *  Who can see a sesh at all — unverified, expired, an expired host, a
 *  cancelled sesh — is already pinned in sesh-rls.test.ts and is not repeated
 *  here. The one gap that file left is a member waiting on review, which this
 *  file covers.
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

/** Nonsense on purpose. A real word would match seshes left behind by another
 *  test run against the same project. */
const MARKER = `zqxlmarker${Date.now()}`;

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const search = (db: SupabaseClient, query: string) =>
  db.from("seshes").select("id, title").textSearch("search_vector", query, { type: "websearch", config: "english" });

describe.skipIf(!configured)("the sesh feed", () => {
  let service: SupabaseClient;
  let host: Member;
  let pending: Member;
  const created: string[] = [];

  async function makeMember(tag: string, status: "verified" | "pending_review"): Promise<Member> {
    const email = `feed-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    await service
      .from("profiles")
      .update({
        status,
        card_expires_on: status === "verified" ? isoDay(200) : null,
        attested_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);
    return { id: data.user.id, db };
  }

  async function create(overrides: Record<string, unknown> = {}) {
    const result = await host.db
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
    if (result.error) throw new Error(`insert failed: ${result.error.message}`);
    created.push(result.data!.id as string);
    return result.data!.id as string;
  }

  /** area_name has no INSERT grant — it is always a follow-up update. */
  async function setAreaName(id: string, areaName: string) {
    const { error } = await host.db.from("seshes").update({ area_name: areaName }).eq("id", id);
    if (error) throw new Error(`area_name update failed: ${error.message}`);
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host", "verified");
    pending = await makeMember("pending", "pending_review");
  }, 90_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    for (const m of [host, pending]) if (m?.id) await service.auth.admin.deleteUser(m.id);
  }, 90_000);

  describe("who gets a feed", () => {
    it("shows nothing to a member still waiting on review", async () => {
      await create();

      const { data } = await pending.db.from("seshes").select("id");

      expect(data).toEqual([]);
    });
  });

  describe("search", () => {
    it("finds a sesh by a word in its title", async () => {
      await create({ title: `Bring a ${MARKER}` });

      const { data } = await search(host.db, MARKER);

      expect(data).toHaveLength(1);
    });

    it("finds a sesh by a word in its description", async () => {
      await create({ description: `We will have a ${MARKER} out back` });

      const { data } = await search(host.db, MARKER);

      expect(data).toHaveLength(1);
    });

    it("finds a sesh by its area name", async () => {
      const id = await create();
      await setAreaName(id, MARKER.slice(0, 40));

      const { data } = await search(host.db, MARKER.slice(0, 40));

      expect(data).toHaveLength(1);
    });

    it("does not return a sesh that has nothing to do with the words", async () => {
      await create({ title: "Quiet movie evening" });

      const { data } = await search(host.db, MARKER);

      expect(data).toEqual([]);
    });

    it("matches whatever case the member typed", async () => {
      await create({ title: `Bring a ${MARKER}` });

      const { data } = await search(host.db, MARKER.toUpperCase());

      expect(data).toHaveLength(1);
    });

    /** The column is an english tsvector, so "blankets" and "blanket" are the
     *  same word. A member should not have to guess the plural.
     *
     *  The marker stays a separate word. Glued on it would make one token
     *  containing digits, which Postgres classes as a numword and never
     *  stems — the test would fail for a reason that has nothing to do with
     *  the schema. */
    it("matches a word in a different form", async () => {
      await create({ title: `${MARKER} blankets` });

      const { data } = await search(host.db, `${MARKER} blanket`);

      expect(data).toHaveLength(1);
    });
  });

  describe("order and paging", () => {
    it("puts the soonest sesh first", async () => {
      const later = await create({ title: `${MARKER} later`, starts_at: hoursFromNow(72) });
      const sooner = await create({ title: `${MARKER} sooner`, starts_at: hoursFromNow(24) });

      const { data } = await host.db
        .from("seshes")
        .select("id")
        .in("id", [later, sooner])
        .order("starts_at", { ascending: true });

      expect(data!.map((row) => row.id)).toEqual([sooner, later]);
    });

    it("gives a second page that does not repeat the first", async () => {
      for (let i = 0; i < 4; i++) await create({ title: `${MARKER} ${i}`, starts_at: hoursFromNow(24 + i) });

      const page = (from: number, to: number) =>
        host.db.from("seshes").select("id").in("id", created).order("starts_at", { ascending: true }).range(from, to);
      const first = await page(0, 1);
      const second = await page(2, 3);

      expect(first.data).toHaveLength(2);
      expect(second.data).toHaveLength(2);
      expect(first.data!.map((r) => r.id)).not.toEqual(expect.arrayContaining(second.data!.map((r) => r.id)));
    });
  });

  describe("the seat counter", () => {
    it("starts at nobody, so the feed can say how many spots are left", async () => {
      const id = await create();

      const { data } = await host.db.from("seshes").select("capacity, approved_count").eq("id", id).single();

      expect(data).toEqual({ capacity: 6, approved_count: 0 });
    });

    it("cannot be written by a host, but can by service_role", async () => {
      const id = await create();

      const asHost = await host.db.from("seshes").update({ approved_count: 99 }).eq("id", id);
      const asService = await service.from("seshes").update({ approved_count: 3 }).eq("id", id);

      expect(asHost.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
      expect(asService.error).toBeNull();
    });
  });
});
