/** @vitest-environment node
 *
 *  The 7-day address wipe. Tested through PostgREST against the real project.
 *  Skipped without the service key.
 *
 *  Twelve hours after a sesh the address becomes unreadable — that is a rule
 *  about who may read it, and the data is still sitting in the table. This is
 *  the other half: seven days later it is gone. Seven days matches the card
 *  image reaper, so the app has one retention story rather than two.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && SECRET);

const TAMPA = { lat: 27.9506, lng: -82.4572 };
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe.skipIf(!configured)("the 7-day address wipe", () => {
  let service: SupabaseClient;
  let hostId: string;
  const created: string[] = [];

  async function makeSesh(startsAt: string, overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: hostId,
        title: "Test sesh",
        sesh_type: "chill",
        starts_at: startsAt,
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
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    created.push(data!.id as string);
    return data!.id as string;
  }

  const rowOf = async (id: string) =>
    (
      await service
        .from("seshes")
        .select("address_line, unit_note, gate_code, exact_lat, exact_lng, area_name, title, starts_at, fuzzy_lat")
        .eq("id", id)
        .single()
    ).data!;

  const reap = () => service.rpc("sesh_address_reaper");

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `reaper-host-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: "Rls-probe-8f2a1c9d4b7e!",
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`could not create host: ${error?.message}`);
    hostId = data.user.id;
    const day = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    await service.from("profiles").update({ status: "verified", card_expires_on: day }).eq("id", hostId);
  }, 60_000);

  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    if (hostId) await service.auth.admin.deleteUser(hostId);
  }, 60_000);

  it("takes the street, the unit, the gate code and the exact point off a sesh eight days past", async () => {
    const id = await makeSesh(daysAgo(8));

    await reap();

    const row = await rowOf(id);
    expect(row.address_line).toBeNull();
    expect(row.unit_note).toBeNull();
    expect(row.gate_code).toBeNull();
    expect(row.exact_lat).toBeNull();
    expect(row.exact_lng).toBeNull();
  });

  /** A member keeps a history of where they went without the app keeping
   *  where that was. */
  it("leaves the title, the times, the circle and the area name alone", async () => {
    const id = await makeSesh(daysAgo(8));
    await service.from("seshes").update({ area_name: "Riverside" }).eq("id", id);

    await reap();

    const row = await rowOf(id);
    expect(row.title).toBe("Test sesh");
    expect(row.area_name).toBe("Riverside");
    expect(row.starts_at).not.toBeNull();
    expect(row.fuzzy_lat).not.toBeNull();
  });

  it("leaves a sesh six days past completely alone", async () => {
    const id = await makeSesh(daysAgo(6));

    await reap();

    const row = await rowOf(id);
    expect(row.address_line).toBe("1 Test Street");
    expect(row.exact_lat).not.toBeNull();
  });

  it("leaves an upcoming sesh completely alone", async () => {
    const id = await makeSesh(new Date(Date.now() + 86_400_000).toISOString());

    await reap();

    expect((await rowOf(id)).address_line).toBe("1 Test Street");
  });

  it("wipes a cancelled sesh too, once it is old enough", async () => {
    const id = await makeSesh(daysAgo(8), { status: "cancelled" });

    await reap();

    expect((await rowOf(id)).address_line).toBeNull();
  });

  it("says how many it took", async () => {
    await makeSesh(daysAgo(8));
    await makeSesh(daysAgo(9));

    const { data } = await reap();

    expect(Number(data)).toBeGreaterThanOrEqual(2);
  });

  /** Running twice must not count the same sesh again, or the cron's own
   *  report becomes noise. */
  it("has nothing left to do the second time", async () => {
    await makeSesh(daysAgo(8));
    await reap();

    const { data } = await reap();

    expect(Number(data)).toBe(0);
  });

  it("cannot be run by a member", async () => {
    const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const anon = createClient(URL!, publishable, { auth: { persistSession: false } });

    const { error } = await anon.rpc("sesh_address_reaper");

    expect(error).not.toBeNull();
  });
});
