/** @vitest-environment node
 *
 *  The fuzzy circle, tested through PostgREST against the real project, the
 *  same way as profiles-rls.test.ts. Skipped without the service key.
 *
 *  These are property tests, on purpose. Re-deriving the HMAC in TypeScript
 *  and checking the trigger agrees would pass by construction and could never
 *  disagree with the code. What matters is what the spec promises: one address
 *  always gives one circle, the offset is inside a known band, and the circle
 *  moves only when the pin moves.
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

/** Two real Tampa points, far enough apart to be different addresses. */
const TAMPA = { lat: 27.9506, lng: -82.4572 };
const TAMPA_ELSEWHERE = { lat: 27.9712, lng: -82.4301 };

const MIN_OFFSET_M = 150;
const MAX_OFFSET_M = 400;

/** The trigger converts metres to degrees with a flat-earth constant of
 *  111320 m per degree. True metres per degree of latitude at Florida's
 *  latitude is nearer 110900, so a measured distance runs about 0.4% short of
 *  the intended one. 1% either way covers that without being wide enough to
 *  hide a wrong radius or a missing offset. */
const TOLERANCE = 0.01;

/** Haversine — an independent source of truth. The trigger uses a flat
 *  approximation; if this used the same approximation the test could not
 *  disagree with it. */
function metresApart(a: Point, b: Point): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Point = { lat: number; lng: number };
type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function soon(hours = 48): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe.skipIf(!configured)("sesh fuzzy circle", () => {
  let service: SupabaseClient;
  let host: Member;
  const created: string[] = [];

  async function makeVerifiedMember(tag: string): Promise<Member> {
    const email = `fuzz-${tag}-${Date.now()}@meet4weed.test`;
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

  /** Creates through the member's own session, so the column grants and the
   *  insert policy are on the path — not a service_role shortcut. */
  async function host_creates(point: Point, title = "Test sesh"): Promise<string> {
    const { data, error } = await host.db
      .from("seshes")
      .insert({
        host_id: host.id,
        title,
        sesh_type: "chill",
        starts_at: soon(),
        capacity: 6,
        exact_lat: point.lat,
        exact_lng: point.lng,
        address_line: "1 Test Street",
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert failed: ${error.message}`);
    created.push(data!.id as string);
    return data!.id as string;
  }

  /** The member may read the fuzzy point. Only service_role may read the
   *  exact one, which is the whole point of the column grants. */
  async function fuzzyOf(id: string): Promise<Point> {
    const { data, error } = await host.db.from("seshes").select("fuzzy_lat, fuzzy_lng").eq("id", id).single();
    if (error) throw new Error(`could not read fuzzy point: ${error.message}`);
    return { lat: data!.fuzzy_lat as number, lng: data!.fuzzy_lng as number };
  }

  async function radiusOf(id: string): Promise<number> {
    const { data } = await host.db.from("seshes").select("fuzzy_radius_m").eq("id", id).single();
    return data!.fuzzy_radius_m as number;
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeVerifiedMember("host");
  }, 60_000);

  /** Each test starts the host at zero open seshes. Without this the run trips
   *  the five-open-sesh cap partway through — which is the cap working, but it
   *  would make these tests depend on the order they run in. */
  afterEach(async () => {
    if (created.length) await service.from("seshes").delete().in("id", created);
    created.length = 0;
  });

  afterAll(async () => {
    if (host?.id) await service.auth.admin.deleteUser(host.id);
  }, 60_000);

  it("puts the published circle between 150 m and 400 m from the real address", async () => {
    const id = await host_creates(TAMPA);

    const distance = metresApart(TAMPA, await fuzzyOf(id));

    expect(distance).toBeGreaterThanOrEqual(MIN_OFFSET_M * (1 - TOLERANCE));
    expect(distance).toBeLessThanOrEqual(MAX_OFFSET_M * (1 + TOLERANCE));
  });

  it("always leaves the real address inside the circle it draws", async () => {
    const id = await host_creates(TAMPA_ELSEWHERE);

    const distance = metresApart(TAMPA_ELSEWHERE, await fuzzyOf(id));

    expect(distance).toBeLessThanOrEqual(await radiusOf(id));
  });

  it("gives one address the same circle every time, so ten seshes cannot be averaged", async () => {
    const first = await host_creates(TAMPA, "First night");
    const second = await host_creates(TAMPA, "Second night");

    expect(await fuzzyOf(second)).toEqual(await fuzzyOf(first));
  });

  it("gives a different address a different circle", async () => {
    const here = await host_creates(TAMPA);
    const there = await host_creates(TAMPA_ELSEWHERE);

    expect(await fuzzyOf(there)).not.toEqual(await fuzzyOf(here));
  });

  it("leaves the circle alone when the host edits something that is not the pin", async () => {
    const id = await host_creates(TAMPA);
    const before = await fuzzyOf(id);

    await host.db.from("seshes").update({ title: "Renamed" }).eq("id", id);

    expect(await fuzzyOf(id)).toEqual(before);
  });

  it("moves the circle when the host moves the pin", async () => {
    const id = await host_creates(TAMPA);
    const before = await fuzzyOf(id);

    await host.db
      .from("seshes")
      .update({ exact_lat: TAMPA_ELSEWHERE.lat, exact_lng: TAMPA_ELSEWHERE.lng })
      .eq("id", id);

    expect(await fuzzyOf(id)).not.toEqual(before);
  });
});
