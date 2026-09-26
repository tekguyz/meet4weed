/** @vitest-environment node
 *
 *  Issue #55 — the clock-driven notifications and the 90-day reaper, run
 *  against the hosted project with the service key, as the cron job runs them.
 *
 *  The idempotency test is the one that matters: run the pass twice, and the
 *  second run writes nothing. The unique index does that, not the code.
 *
 *  reapOldNotifications() deletes project-wide. It is called from this file
 *  and no other, so no parallel file can lose its fixtures to it.
 *
 *  Skipped without the service key, which is how CI sees it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, floridaToday } from "@/lib/dates";
import { reapOldNotifications, runClockNotices } from "@/lib/notify/clock";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && SECRET);

const PASSWORD = "Clock-probe-3e8b1f6a9c2d!";

describe.skipIf(!configured)("the clock-driven notifications", () => {
  let service: SupabaseClient;
  let host: string;
  let guest: string;
  let lapsing: string;
  let soonSesh: string;
  let laterSesh: string;
  const made: string[] = [];
  const today = floridaToday();

  async function makeMember(tag: string, cardExpiresOn: string): Promise<string> {
    const email = `clock-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);
    const { error: verifyError } = await service
      .from("profiles")
      .update({ status: "verified", card_expires_on: cardExpiresOn, attested_at: new Date().toISOString() })
      .eq("id", data.user.id);
    if (verifyError) throw new Error(`could not verify ${tag}: ${verifyError.code}`);
    return data.user.id;
  }

  async function makeSesh(title: string, hoursAway: number): Promise<string> {
    const { data, error } = await service
      .from("seshes")
      .insert({
        host_id: host,
        title,
        sesh_type: "chill",
        starts_at: new Date(Date.now() + hoursAway * 3_600_000).toISOString(),
        capacity: 6,
        exact_lat: 27.9506,
        exact_lng: -82.4572,
        address_line: "1 Test Street",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`could not create a sesh: ${error?.message}`);
    return data.id as string;
  }

  async function rowsFor(recipient: string) {
    const { data } = await service
      .from("notifications")
      .select("type, sesh_id, actor_id, payload")
      .eq("recipient_id", recipient)
      .order("type");
    return data ?? [];
  }

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    host = await makeMember("host", addDays(today, 200));
    guest = await makeMember("guest", addDays(today, 200));
    // On the 7-day rung, and lapses before a sesh ten days out.
    lapsing = await makeMember("lapsing", addDays(today, 3));

    soonSesh = await makeSesh("Clock probe soon", 12);
    laterSesh = await makeSesh("Clock probe later", 24 * 10);

    const { error } = await service.from("rsvps").insert([
      { sesh_id: soonSesh, member_id: guest, status: "approved" },
      { sesh_id: laterSesh, member_id: guest, status: "approved" },
      { sesh_id: laterSesh, member_id: lapsing, status: "approved" },
    ]);
    if (error) throw new Error(`could not add the guests: ${error.message}`);
  }, 60_000);

  afterAll(async () => {
    // The recipient cascade removes every row these members received.
    for (const id of made) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it("reminds the guest of the sesh within a day, and of nothing else", async () => {
    await runClockNotices(service, new Date());

    expect(await rowsFor(guest)).toEqual([{ type: "sesh_reminder", sesh_id: soonSesh, actor_id: null, payload: {} }]);
  });

  it("warns the member whose card is on the ladder, and the host whose guest it strands", async () => {
    expect(await rowsFor(lapsing)).toEqual([
      { type: "card_expiry", sesh_id: null, actor_id: null, payload: { about: "self", cardExpiresOn: addDays(today, 3) } },
    ]);
    expect(await rowsFor(host)).toEqual([
      { type: "card_expiry", sesh_id: laterSesh, actor_id: lapsing, payload: { about: "guest", cardExpiresOn: addDays(today, 3) } },
    ]);
  });

  it("writes nothing on a second run the same day", async () => {
    const before = [...(await rowsFor(guest)), ...(await rowsFor(lapsing)), ...(await rowsFor(host))];

    expect(await runClockNotices(service, new Date())).toEqual({ reminders: 0, cardNotices: 0, hostNotices: 0 });

    expect([...(await rowsFor(guest)), ...(await rowsFor(lapsing)), ...(await rowsFor(host))]).toEqual(before);
  });

  it("refuses a dedup_key on an action row, so the index never swallows one", async () => {
    const { error } = await service
      .from("notifications")
      .insert({ recipient_id: host, type: "rsvp_requested", sesh_id: soonSesh, dedup_key: "x" });
    expect(error?.code).toBe("23514");
  });

  it("deletes notifications older than 90 days, and keeps the rest", async () => {
    const { data, error } = await service
      .from("notifications")
      .insert([
        { recipient_id: host, type: "rsvp_requested", sesh_id: soonSesh, created_at: new Date(Date.now() - 91 * 86_400_000).toISOString() },
        { recipient_id: host, type: "rsvp_requested", sesh_id: soonSesh, created_at: new Date(Date.now() - 89 * 86_400_000).toISOString() },
      ])
      .select("id");
    if (error || !data) throw new Error(`could not write the aged rows: ${error?.code}`);
    const [old, young] = data.map((row) => row.id as string);

    expect(await reapOldNotifications(service, new Date())).toBeGreaterThanOrEqual(1);

    const { data: left } = await service.from("notifications").select("id").in("id", [old, young]);
    expect((left ?? []).map((row) => row.id)).toEqual([young]);
  });
});
