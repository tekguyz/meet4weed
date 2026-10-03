/** @vitest-environment node
 *
 *  The guard for a silent 42501.
 *
 *  Every other RLS test in this folder hand-picks a narrow column list,
 *  because each one is about a particular rule. That is exactly how
 *  lib/sesh/queries.ts shipped a column list a member could not read: the app
 *  asks for fifteen columns in one go, and nothing was asking for those
 *  fifteen.
 *
 *  What made it invisible is worth stating, because it will happen again.
 *  Those query functions end `return (data ?? []).map(...)`. A refused query
 *  and an empty project look IDENTICAL from a screen — the feed renders
 *  "nothing on yet", a sesh page renders a 404 — and per CLAUDE.md a SELECT
 *  that names one non-granted column fails WHOLE, not partially. Nothing
 *  throws. Nothing logs.
 *
 *  So this file reads the column list OUT OF THE APP and sends it as one
 *  query, as the app does. It asserts nothing about which columns there are.
 *  The day somebody adds a sixteenth without a grant, this goes red.
 *
 *  Skipped without SUPABASE_SECRET_KEY, so CI never runs it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";
const INSUFFICIENT_PRIVILEGE = "42501";
const TAMPA = { lat: 27.9506, lng: -82.4572 };

/** Taken from the app, never retyped. A copy here would drift and then agree
 *  with itself while the app was broken. */
function listColumnsFromApp(): string {
  const source = readFileSync(resolve(process.cwd(), "lib/sesh/queries.ts"), "utf8");
  const match = source.match(/const LIST_COLUMNS\s*=\s*\n?\s*"([^"]+)"/);
  if (!match) throw new Error("could not find LIST_COLUMNS in lib/sesh/queries.ts");
  return match[1];
}

/** The feed's Host embed (#125), also taken from the app. */
function feedHostFromApp(): string {
  const source = readFileSync(resolve(process.cwd(), "lib/sesh/queries.ts"), "utf8");
  const match = source.match(/const FEED_HOST\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("could not find FEED_HOST in lib/sesh/queries.ts");
  return match[1];
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!configured)("the columns the app actually asks for", () => {
  let service: SupabaseClient;
  let host: { id: string; db: SupabaseClient };
  let browser: { id: string; db: SupabaseClient };
  let sesh: string;
  let unlisted: string;
  const LIST = listColumnsFromApp();
  const FEED_HOST = feedHostFromApp();
  const SEED = `seed-${Date.now()}`;

  async function makeMember(tag: string) {
    const email = `it-listcols-${tag}-${Date.now()}@meet4weed.test`;
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

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });

    host = await makeMember("host");
    browser = await makeMember("browser");
    await service.from("profiles").update({ avatar_seed: SEED }).eq("id", host.id);

    const { data: row, error: insertError } = await host.db
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Column probe",
        sesh_type: "chill",
        starts_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        capacity: 6,
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`sesh insert failed: ${insertError.message}`);
    sesh = row!.id as string;

    const { data: hidden, error: hiddenError } = await host.db
      .from("seshes")
      .insert({
        host_id: host.id,
        title: "Unlisted column probe",
        sesh_type: "chill",
        starts_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        capacity: 6,
        visibility: "unlisted",
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
      })
      .select("id")
      .single();
    if (hiddenError) throw new Error(`unlisted sesh insert failed: ${hiddenError.message}`);
    unlisted = hidden!.id as string;
  }, 120_000);

  afterAll(async () => {
    const seshes = [sesh, unlisted].filter(Boolean);
    if (seshes.length) await service.from("seshes").delete().in("id", seshes);
    if (host?.id) await service.auth.admin.deleteUser(host.id);
    if (browser?.id) await service.auth.admin.deleteUser(browser.id);
  }, 120_000);

  /** getSesh() and getMySesh(). A 404 on a host's own sesh was the symptom. */
  it("lets a member read one sesh with the app's whole column list", async () => {
    const { data, error } = await host.db.from("seshes").select(LIST).eq("id", sesh).maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  /** listFeed(). An empty feed was the other symptom, and it read exactly
   *  like a project with nothing on. */
  it("lets a member read the feed with the app's whole column list", async () => {
    const { error } = await host.db
      .from("seshes")
      .select(LIST)
      .eq("status", "open")
      .gt("starts_at", new Date().toISOString());

    expect(error).toBeNull();
  });

  /** listFeed() with the Host joined (#125): another member, browsing, gets
   *  the Host's handle and Avatar seed on the card — and the join does not
   *  bring back the unlisted sesh the seshes policy hides. */
  it("gives a browsing member the Host on each feed sesh, and still no unlisted one", async () => {
    const { data, error } = await browser.db
      .from("seshes")
      .select(`${LIST}, ${FEED_HOST}`)
      .eq("status", "open")
      .eq("host_id", host.id)
      .gt("starts_at", new Date().toISOString());

    expect(error).toBeNull();
    const rows = (data ?? []) as unknown as { id: string; host: { handle: string; avatar_seed: string } | null }[];
    expect(rows.map((r) => r.id)).toEqual([sesh]);
    expect(rows[0].host?.handle).toBeTruthy();
    expect(rows[0].host?.avatar_seed).toBe(SEED);
  });

  /** listMySeshes(). */
  it("lets a member read their own seshes with the app's whole column list", async () => {
    const { data, error } = await host.db.from("seshes").select(LIST).eq("host_id", host.id);

    expect(error).toBeNull();
    // A Host sees their own unlisted sesh too.
    expect(data).toHaveLength(2);
  });

  /** Column by column, so a failure NAMES the column instead of leaving the
   *  next person to bisect fifteen of them by hand. */
  it("grants every single column in that list", async () => {
    const columns = LIST.split(",").map((c) => c.trim());

    const denied: string[] = [];
    for (const column of columns) {
      const { error } = await host.db.from("seshes").select(column).eq("id", sesh).maybeSingle();
      if (error) denied.push(column);
    }

    expect(denied).toEqual([]);
  }, 60_000);

  /** The other half of the rule, unchanged: the private columns stay private,
   *  and a wildcard still fails outright rather than quietly trimming them.
   *  This is here so a future "fix" that grants the whole table to make the
   *  tests above pass goes red immediately. */
  it("still refuses the address columns and a wildcard", async () => {
    const named = await host.db.from("seshes").select("address_line, gate_code").eq("id", sesh);
    const wildcard = await host.db.from("seshes").select("*").eq("id", sesh);
    const asService = await service.from("seshes").select("address_line").eq("id", sesh);

    expect(named.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    expect(wildcard.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    expect(asService.error).toBeNull();
  });
});
