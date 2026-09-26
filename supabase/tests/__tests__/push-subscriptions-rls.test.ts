/** @vitest-environment node
 *
 *  Issue #56 — who can do what to public.push_subscriptions. A subscription
 *  is a tracking handle, so it is write-only to the member: they insert and
 *  delete their own, and nobody but service_role reads one — not even the
 *  member it belongs to. Prior art: notifications-rls.test.ts.
 *
 *  Every refusal is proved differentially: the same statement on the same row
 *  fails for a member and lands for service_role, so the refusal is the rule
 *  and not a broken table. No live rule is weakened to make a test go red.
 *
 *  Skipped when the service key is absent, which is how CI sees it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { forgetDevice, saveDevice } from "@/lib/notify/push-subscriptions";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Rls-probe-3c7e9a1f5d2b!";

type Member = { id: string; db: SupabaseClient };

let n = 0;
function device(tag: string) {
  n += 1;
  return {
    endpoint: `https://push.example.test/${tag}-${Date.now()}-${n}`,
    keys: { p256dh: `p256dh-${tag}-${n}`, auth: `auth-${tag}-${n}` },
  };
}

function rowFor(member: Member, d: ReturnType<typeof device>) {
  return { member_id: member.id, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, user_agent: "vitest" };
}

describe.skipIf(!configured)("push_subscriptions RLS", () => {
  let admin: SupabaseClient;
  let alice: Member;
  let bob: Member;
  const made: string[] = [];

  async function makeMember(tag: string): Promise<Member> {
    const email = `push-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);

    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    return { id: data.user.id, db };
  }

  async function owner(endpoint: string): Promise<string | null> {
    const { data } = await admin.from("push_subscriptions").select("member_id").eq("endpoint", endpoint).maybeSingle();
    return (data?.member_id as string | undefined) ?? null;
  }

  beforeAll(async () => {
    admin = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    alice = await makeMember("alice");
    bob = await makeMember("bob");
  }, 60_000);

  afterAll(async () => {
    // The member cascade removes every subscription these members saved.
    for (const id of made) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  it("lets a member insert their own subscription", async () => {
    const d = device("own");

    const { error } = await alice.db.from("push_subscriptions").insert(rowFor(alice, d));

    expect(error).toBeNull();
    expect(await owner(d.endpoint)).toBe(alice.id);
  });

  it("refuses a member's INSERT for somebody else, and lets service_role make it", async () => {
    const d = device("forged");

    const { error } = await alice.db.from("push_subscriptions").insert(rowFor(bob, d));
    expect(error?.code).toBe("42501");
    expect(await owner(d.endpoint)).toBeNull();

    const { error: adminError } = await admin.from("push_subscriptions").insert(rowFor(bob, d));
    expect(adminError).toBeNull();
    expect(await owner(d.endpoint)).toBe(bob.id);
  });

  it("refuses a member's SELECT of every row, their own included, and lets service_role read it", async () => {
    const d = device("read");
    const { error: insertError } = await alice.db.from("push_subscriptions").insert(rowFor(alice, d));
    expect(insertError).toBeNull();

    for (const columns of ["id", "endpoint", "p256dh", "auth", "member_id", "*"]) {
      const { data, error } = await alice.db.from("push_subscriptions").select(columns).eq("member_id", alice.id);
      expect(error?.code, columns).toBe("42501");
      expect(data).toBeNull();
    }

    const { data, error } = await admin.from("push_subscriptions").select("id").eq("endpoint", d.endpoint);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("refuses an INSERT that asks for the row back, because that is a read", async () => {
    const { error } = await alice.db.from("push_subscriptions").insert(rowFor(alice, device("returning"))).select("id");
    expect(error?.code).toBe("42501");
  });

  it("lets a member delete their own rows and never somebody else's", async () => {
    const mine = device("mine");
    const theirs = device("theirs");
    expect((await alice.db.from("push_subscriptions").insert(rowFor(alice, mine))).error).toBeNull();
    expect((await admin.from("push_subscriptions").insert(rowFor(bob, theirs))).error).toBeNull();

    // A filter on a column reads the row, and a member has no read, so a
    // filtered DELETE is refused outright, on their own row too.
    const { error: filtered } = await alice.db.from("push_subscriptions").delete().eq("endpoint", mine.endpoint);
    expect(filtered?.code).toBe("42501");
    expect(await owner(mine.endpoint)).toBe(alice.id);

    // And the project runs pg_safeupdate, which refuses a DELETE with no
    // WHERE at all. So through the Data API a member can delete nothing; the
    // delete_own policy is the backstop if either rule ever changes.
    const { error: unfiltered } = await alice.db.from("push_subscriptions").delete();
    expect(unfiltered?.code).toBe("21000");
    expect(await owner(mine.endpoint)).toBe(alice.id);
    expect(await owner(theirs.endpoint)).toBe(bob.id);

    // The same filtered statement lands for service_role.
    const { error: adminError } = await admin.from("push_subscriptions").delete().eq("endpoint", mine.endpoint);
    expect(adminError).toBeNull();
    expect(await owner(mine.endpoint)).toBeNull();
  });

  it("forgets one device through the server, only for the member it belongs to", async () => {
    // Why the app deletes through the server: one device, not every device,
    // and the filter that picks it is a read a member does not have.
    const mine = device("forget-mine");
    const theirs = device("forget-theirs");
    await saveDevice(admin, alice.id, mine, "vitest");
    await saveDevice(admin, bob.id, theirs, "vitest");

    await forgetDevice(admin, alice.id, theirs.endpoint);
    expect(await owner(theirs.endpoint)).toBe(bob.id);

    await forgetDevice(admin, alice.id, mine.endpoint);
    expect(await owner(mine.endpoint)).toBeNull();
  });

  it("refuses an endpoint that is not https, for service_role too", async () => {
    const d = { ...device("plain"), endpoint: "http://169.254.169.254/latest" };

    const { error } = await admin.from("push_subscriptions").insert(rowFor(alice, d));

    expect(error?.code).toBe("23514");
  });

  it("hands a device to whoever signs in on it next", async () => {
    const d = device("shared");
    await saveDevice(admin, alice.id, d, "vitest");
    expect(await owner(d.endpoint)).toBe(alice.id);

    await saveDevice(admin, bob.id, d, "vitest");

    expect(await owner(d.endpoint)).toBe(bob.id);
  });

  it("keeps one row per device when the same member saves it twice", async () => {
    const d = device("twice");
    await saveDevice(admin, alice.id, d, "vitest");
    await saveDevice(admin, alice.id, d, "vitest");

    const { data } = await admin.from("push_subscriptions").select("id").eq("endpoint", d.endpoint);
    expect(data).toHaveLength(1);
  });

  it("goes with the member when their account is deleted", async () => {
    const d = device("cascade");
    await saveDevice(admin, bob.id, d, "vitest");

    await admin.auth.admin.deleteUser(bob.id);

    expect(await owner(d.endpoint)).toBeNull();
  });
});
