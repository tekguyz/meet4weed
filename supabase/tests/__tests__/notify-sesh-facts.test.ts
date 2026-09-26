/** @vitest-environment node
 *
 *  Issue #54. The reads a sesh notification makes, run through the members'
 *  own sessions against the hosted project. The seshes table grants SELECT
 *  column by column, and a query naming one ungranted column fails whole —
 *  which these helpers turn into "nobody is told". This file is the guard.
 *  Skipped without the service key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approvedGuestIds, readMyRsvpStatus, readSeshFacts, readTravelFacts } from "@/lib/notify/sesh-facts";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Facts-probe-7c2e9a4b1d6f!";

type Member = { id: string; db: SupabaseClient };

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!configured)("the reads behind a sesh notification", () => {
  let service: SupabaseClient;
  let host: Member;
  let approved: Member;
  let waiting: Member;
  let seshId: string;
  const made: string[] = [];

  async function makeMember(tag: string): Promise<Member> {
    const email = `facts-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);

    await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: isoDay(200), attested_at: new Date().toISOString() })
      .eq("id", data.user.id);

    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);
    return { id: data.user.id, db };
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host");
    approved = await makeMember("approved");
    waiting = await makeMember("waiting");

    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Facts probe",
        sesh_type: "chill",
        starts_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        capacity: 6,
        exact_lat: 27.9506,
        exact_lng: -82.4572,
        address_line: "1 Test Street",
        unit_note: "Apt 4",
        gate_code: "1234",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`could not create a sesh: ${error?.message}`);
    seshId = data.id as string;

    const { error: rsvpError } = await service.from("rsvps").insert([
      { sesh_id: seshId, member_id: approved.id, status: "approved" },
      { sesh_id: seshId, member_id: waiting.id, status: "requested" },
    ]);
    if (rsvpError) throw new Error(`could not add the guests: ${rsvpError.message}`);
  }, 60_000);

  afterAll(async () => {
    for (const id of made) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it("lets a member who asked to join read who hosts it", async () => {
    expect(await readSeshFacts(waiting.db, seshId)).toEqual({ hostId: host.id, title: "Facts probe", status: "open" });
  });

  it("lets the host read when and where, address included", async () => {
    expect(await readTravelFacts(host.db, seshId)).toMatchObject({
      hostId: host.id,
      status: "open",
      addressLine: "1 Test Street",
      unitNote: "Apt 4",
      gateCode: "1234",
      materiallyChangedAt: null,
    });
  });

  it("lists only the approved guests, through the host's own session", async () => {
    expect(await approvedGuestIds(host.db, seshId)).toEqual([approved.id]);
  });

  it("lets a member read their own RSVP status, and finds none for the host", async () => {
    expect(await readMyRsvpStatus(waiting.db, seshId, waiting.id)).toBe("requested");
    expect(await readMyRsvpStatus(host.db, seshId, host.id)).toBeNull();
  });
});
