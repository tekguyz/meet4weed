/** @vitest-environment node
 *
 *  The 7-day reaper. Tested through PostgREST against the real project.
 *  Skipped without the service key.
 *
 *  ONE FILE, because there is one reaper. It deletes across the whole project
 *  in a single call, so two test files calling it at the same time delete
 *  each other's fixtures. Vitest runs files in parallel and describes inside
 *  a file in order, and that ordering is what keeps these honest.
 *
 *  Twelve hours after a sesh the address becomes unreadable — that is a rule
 *  about who may read it, and the data is still sitting in the table. This is
 *  the other half: seven days later it is gone. Seven days matches the card
 *  image reaper, so the app has one retention story rather than two.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
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

/** Plan 04, ticket #32 — the rest of what the app forgets.
 *
 *  The address wipe above forgets WHERE a sesh was. This forgets WHAT people
 *  brought to a named person's home, WHO was handed a link to it, and WHO
 *  walked through that link's door.
 *
 *  Same function, same run, same seven days. Not a second scheduled job.
 */
describe.skipIf(!configured)("the 7-day history wipe", () => {
  let service: SupabaseClient;
  /** The guest, signed in as themselves. The differential case needs a real
   *  `authenticated` session: the grants revoke from `anon` and from
   *  `authenticated` separately, so an anonymous client proves nothing about
   *  a member. */
  let guest: SupabaseClient;
  let hostId: string;
  let guestId: string;
  const seshes: string[] = [];
  const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";

  const someHash = () => createHash("sha256").update(randomBytes(16)).digest("hex");

  /** A sesh with everything on it: an address, a bring list, a live link, and
   *  somebody who walked through that link. */
  async function makeLoadedSesh(startsAt: string, overrides: Record<string, unknown> = {}): Promise<string> {
    const { data: sesh, error } = await service
      .from("seshes")
      .insert({
        host_id: hostId,
        title: "Test sesh",
        sesh_type: "chill",
        starts_at: startsAt,
        capacity: 6,
        area_name: "Riverside",
        exact_lat: TAMPA.lat,
        exact_lng: TAMPA.lng,
        address_line: "1 Test Street",
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`sesh insert failed: ${error.message}`);
    const seshId = sesh!.id as string;
    seshes.push(seshId);

    const { error: contributionError } = await service
      .from("contributions")
      .insert({ sesh_id: seshId, member_id: guestId, kind: "item", label: "Snacks" });
    if (contributionError) throw new Error(`contribution insert failed: ${contributionError.message}`);

    const { data: invite, error: inviteError } = await service
      .from("invites")
      .insert({
        sesh_id: seshId,
        created_by: hostId,
        token_hash: someHash(),
        // mint_invite() clamps an expiry to the sesh start, so a past sesh
        // has a past expiry. The reaper must not care either way.
        expires_at: startsAt,
        max_uses: 5,
      })
      .select("id")
      .single();
    if (inviteError) throw new Error(`invite insert failed: ${inviteError.message}`);

    const { error: claimError } = await service
      .from("invite_claims")
      .insert({ invite_id: invite!.id as string, member_id: guestId, sesh_id: seshId });
    if (claimError) throw new Error(`claim insert failed: ${claimError.message}`);

    return seshId;
  }

  const countOn = async (table: string, seshId: string) => {
    const { count, error } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("sesh_id", seshId);
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    return count ?? 0;
  };

  const reap = () => service.rpc("sesh_address_reaper");

  beforeAll(async () => {
    service = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    const day = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);

    for (const role of ["host", "guest"] as const) {
      const email = `history-reaper-${role}-${Date.now()}@meet4weed.test`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`could not create ${role}: ${error?.message}`);
      await service.from("profiles").update({ status: "verified", card_expires_on: day }).eq("id", data.user.id);

      if (role === "host") {
        hostId = data.user.id;
        continue;
      }

      guestId = data.user.id;
      guest = createClient(URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await guest.auth.signInWithPassword({ email, password: PASSWORD });
      if (signInError) throw new Error(`could not sign in guest: ${signInError.message}`);
    }
  }, 60_000);

  afterEach(async () => {
    if (seshes.length) await service.from("seshes").delete().in("id", seshes);
    seshes.length = 0;
  });

  afterAll(async () => {
    for (const id of [hostId, guestId]) if (id) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it("takes the bring list off a sesh eight days past", async () => {
    const id = await makeLoadedSesh(daysAgo(8));

    await reap();

    expect(await countOn("contributions", id)).toBe(0);
  });

  it("takes the invites and the claims off a sesh eight days past", async () => {
    const id = await makeLoadedSesh(daysAgo(8));

    await reap();

    expect(await countOn("invites", id)).toBe(0);
    expect(await countOn("invite_claims", id)).toBe(0);
  });

  /** One call, and both the address and the history are gone. This is the
   *  case that says "same run", not "second job". */
  it("takes the address in the same call", async () => {
    const id = await makeLoadedSesh(daysAgo(8));

    await reap();

    const { data } = await service.from("seshes").select("address_line, exact_lat").eq("id", id).single();
    expect(data!.address_line).toBeNull();
    expect(data!.exact_lat).toBeNull();
    expect(await countOn("contributions", id)).toBe(0);
  });

  /** A member keeps a history of where they went. */
  it("leaves the title, the start time and the area name alone", async () => {
    const id = await makeLoadedSesh(daysAgo(8));

    await reap();

    const { data } = await service.from("seshes").select("title, starts_at, area_name").eq("id", id).single();
    expect(data!.title).toBe("Test sesh");
    expect(data!.area_name).toBe("Riverside");
    expect(data!.starts_at).not.toBeNull();
  });

  it("leaves a sesh six days past completely alone — the other side of the boundary", async () => {
    const id = await makeLoadedSesh(daysAgo(6));

    await reap();

    expect(await countOn("contributions", id)).toBe(1);
    expect(await countOn("invites", id)).toBe(1);
    expect(await countOn("invite_claims", id)).toBe(1);
  });

  it("leaves an upcoming sesh completely alone", async () => {
    const id = await makeLoadedSesh(new Date(Date.now() + 86_400_000).toISOString());

    await reap();

    expect(await countOn("contributions", id)).toBe(1);
    expect(await countOn("invites", id)).toBe(1);
    expect(await countOn("invite_claims", id)).toBe(1);
  });

  /** Measured from the start time, exactly like the address. A cancelled sesh
   *  is not a sesh nobody ever stood in. */
  it("reaps a cancelled sesh on the same schedule", async () => {
    const id = await makeLoadedSesh(daysAgo(8), { status: "cancelled" });

    await reap();

    expect(await countOn("contributions", id)).toBe(0);
    expect(await countOn("invites", id)).toBe(0);
    expect(await countOn("invite_claims", id)).toBe(0);
  });

  /** A sesh whose address an earlier run already took must still lose its
   *  history. The two are separate passes over the same cut-off, not one
   *  statement guarded by "the address is still there". */
  it("still takes the history when the address is already gone", async () => {
    const id = await makeLoadedSesh(daysAgo(8));
    await service
      .from("seshes")
      .update({ address_line: null, unit_note: null, gate_code: null, exact_lat: null, exact_lng: null })
      .eq("id", id);

    await reap();

    expect(await countOn("contributions", id)).toBe(0);
    expect(await countOn("invites", id)).toBe(0);
  });

  /** Differential, per CLAUDE.md: the same delete, on the same row, fails for
   *  a SIGNED-IN verified member and succeeds for the reaper. No member-facing
   *  path gained a delete in this ticket.
   *
   *  The member here is the guest who owns the claim and the contribution. If
   *  anybody could reach them it would be them, and they cannot. */
  it("is the only thing deleting on this schedule", async () => {
    const id = await makeLoadedSesh(daysAgo(8));

    await guest.from("invite_claims").delete().eq("sesh_id", id);
    await guest.from("invites").delete().eq("sesh_id", id);
    expect(await countOn("invite_claims", id)).toBe(1);
    expect(await countOn("invites", id)).toBe(1);

    await reap();

    expect(await countOn("invite_claims", id)).toBe(0);
    expect(await countOn("invites", id)).toBe(0);
  });
});
