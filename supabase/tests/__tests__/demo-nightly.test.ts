/** @vitest-environment node
 *
 *  Issue #39 — the demo realm's two nightly steps, called the way the expiry
 *  sweep calls them: the exported functions in lib/demo/nightly.ts, with the
 *  service-role client.
 *
 *  ONE FILE, because reapDemoVisitors() deletes across the whole project.
 *  Every other test that makes a visitor makes a young one, which this
 *  reaper leaves alone by design, but only one file may call it.
 *
 *  The "old" identities are made old by backdating their profile's
 *  created_at, which is what the reaper reads as arrival. auth.users cannot be
 *  backdated through the API.
 *
 *  Needs anonymous sign-ins turned on. Skipped without the service key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { addDays, floridaToday, floridaWallClock } from "@/lib/dates";
import { reapDemoVisitors, shiftDemoCast } from "@/lib/demo/nightly";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Nightly-probe-2d7f4a9e1c6b!";
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe.skipIf(!configured)("the demo realm's nightly work", () => {
  let service: SupabaseClient;
  const made: string[] = [];

  async function verify(id: string, patch: Record<string, unknown> = {}) {
    const { error } = await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: addDays(floridaToday(), 200), ...patch })
      .eq("id", id);
    if (error) throw new Error(`could not verify: ${error.message}`);
  }

  async function makeMember(tag: string, isDemo: boolean): Promise<string> {
    const email = `nightly-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);
    await verify(data.user.id, { is_demo: isDemo });
    return data.user.id;
  }

  async function makeVisitor(): Promise<string> {
    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.auth.signInAnonymously();
    if (error || !data.user) throw new Error(`anonymous sign-in failed (is it on in the project?): ${error?.message}`);
    made.push(data.user.id);
    await verify(data.user.id, { is_demo: true });
    return data.user.id;
  }

  const backdate = (id: string, days: number) =>
    service.from("profiles").update({ created_at: daysAgo(days) }).eq("id", id);

  async function makeSesh(host: string, startsAt: string): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host,
        title: "Nightly probe",
        sesh_type: "chill",
        starts_at: startsAt,
        capacity: 6,
        exact_lat: 26.1224,
        exact_lng: -80.1373,
        address_line: "1 Probe Street",
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    return data!.id as string;
  }

  const exists = async (table: string, column: string, id: string) =>
    ((await service.from(table).select(column).eq(column, id)).data ?? []).length > 0;

  beforeAll(() => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    for (const id of made) await service.auth.admin.deleteUser(id);
  }, 120_000);

  describe("shifting the cast", () => {
    let castHost: string;
    let visitor: string;
    let sesh: string;

    beforeAll(async () => {
      castHost = await makeMember("cast", true);
      visitor = await makeVisitor();
      // Deliberately somewhere wrong, a month out.
      sesh = await makeSesh(castHost, new Date(Date.now() + 30 * 86_400_000).toISOString());
      const { error } = await service
        .from("cast_schedule")
        .insert({ sesh_id: sesh, day_offset: 3, local_time: "19:30" });
      if (error) throw new Error(`schedule insert failed: ${error.message}`);
      await service.from("rsvps").insert({ sesh_id: sesh, member_id: visitor, status: "approved" });
    }, 90_000);

    it("puts each cast sesh at its offset from today, Florida time", async () => {
      await shiftDemoCast(service);
      const { data } = await service.from("seshes").select("starts_at, materially_changed_at").eq("id", sesh).single();
      expect(floridaWallClock(new Date(data!.starts_at))).toBe(`${addDays(floridaToday(), 3)}T19:30`);
      // A nightly move is not "the host changed this".
      expect(data!.materially_changed_at).toBeNull();
    });

    it("keeps a visitor's RSVP on it", async () => {
      const { data } = await service.from("rsvps").select("status").eq("sesh_id", sesh).eq("member_id", visitor);
      expect(data).toEqual([{ status: "approved" }]);
    });

    it("moves nothing a second time", async () => {
      await shiftDemoCast(service);
      const before = (await service.from("seshes").select("updated_at").eq("id", sesh).single()).data!.updated_at;
      await shiftDemoCast(service);
      const after = (await service.from("seshes").select("updated_at").eq("id", sesh).single()).data!.updated_at;
      expect(after).toBe(before);
    });

    it("moves no real sesh, even one a schedule row points at", async () => {
      const realHost = await makeMember("real-host", false);
      const startsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const real = await makeSesh(realHost, startsAt);
      await service.from("cast_schedule").insert({ sesh_id: real, day_offset: 1, local_time: "20:00" });

      await shiftDemoCast(service);

      const { data } = await service.from("seshes").select("starts_at").eq("id", real).single();
      expect(new Date(data!.starts_at).getTime()).toBe(new Date(startsAt).getTime());
    });

    it("keeps a cast card current", async () => {
      await service.from("profiles").update({ card_expires_on: addDays(floridaToday(), 5) }).eq("id", castHost);
      await shiftDemoCast(service);
      const { data } = await service.from("profiles").select("status, card_expires_on").eq("id", castHost).single();
      expect(data).toEqual({ status: "verified", card_expires_on: addDays(floridaToday(), 365) });
    });
  });

  describe("deleting old visitors", () => {
    let oldVisitor: string;
    let youngVisitor: string;
    let oldReal: string;
    let oldCast: string;
    let oldVisitorSesh: string;
    let castSesh: string;

    beforeAll(async () => {
      oldVisitor = await makeVisitor();
      youngVisitor = await makeVisitor();
      oldReal = await makeMember("old-real", false);
      oldCast = await makeMember("old-cast", true);

      castSesh = await makeSesh(oldCast, new Date(Date.now() + 2 * 86_400_000).toISOString());
      oldVisitorSesh = await makeSesh(oldVisitor, new Date(Date.now() + 2 * 86_400_000).toISOString());
      await service.from("rsvps").insert({ sesh_id: castSesh, member_id: oldVisitor, status: "approved" });
      await service
        .from("contributions")
        .insert({ sesh_id: castSesh, member_id: oldVisitor, kind: "item", label: "Ice" });
      await service
        .from("notifications")
        .insert({ recipient_id: oldVisitor, type: "rsvp_approved", sesh_id: castSesh, actor_id: oldCast });

      await backdate(oldVisitor, 8);
      await backdate(youngVisitor, 6);
      await backdate(oldReal, 30);
      await backdate(oldCast, 30);

      await reapDemoVisitors(service);
    }, 120_000);

    it("deletes a visitor older than seven days with everything they own", async () => {
      const { data } = await service.auth.admin.getUserById(oldVisitor);
      expect(data.user).toBeNull();
      expect(await exists("profiles", "id", oldVisitor)).toBe(false);
      expect(await exists("seshes", "id", oldVisitorSesh)).toBe(false);
      expect(await exists("rsvps", "member_id", oldVisitor)).toBe(false);
      expect(await exists("contributions", "member_id", oldVisitor)).toBe(false);
      expect(await exists("notifications", "recipient_id", oldVisitor)).toBe(false);
    });

    it("keeps a visitor who arrived six days ago", async () => {
      expect(await exists("profiles", "id", youngVisitor)).toBe(true);
    });

    it("keeps a real member and a cast member of any age", async () => {
      expect(await exists("profiles", "id", oldReal)).toBe(true);
      expect(await exists("profiles", "id", oldCast)).toBe(true);
      expect(await exists("seshes", "id", castSesh)).toBe(true);
    });
  });
});
