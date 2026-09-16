/** @vitest-environment node
 *
 *  The address-privacy guarantee this whole app rests on is a database
 *  property, so it is tested through the database — two real members, two real
 *  sessions, against the real project.
 *
 *  This runs through PostgREST rather than raw SQL on purpose. Column-level
 *  privileges, RLS policies and the Data API's own exposure rules all sit on
 *  that path, and a SQL-only test would skip two of the three.
 *
 *  Skipped when the service key is absent, which is how CI sees it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const configured = Boolean(URL && PUBLISHABLE && SECRET);

/** A password nobody signs in with interactively — these accounts exist for
 *  the length of one test run and are deleted in afterAll. It must pass the
 *  hosted password rule (lower, upper, digit, symbol — spec §4.5): the admin
 *  API enforces it too, and a weaker one fails every test before it starts. */
const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";

type Member = { id: string; email: string; db: SupabaseClient };

describe.skipIf(!configured)("profiles row-level security", () => {
  let admin: SupabaseClient;
  let alice: Member;
  let bob: Member;

  async function makeMember(tag: string): Promise<Member> {
    const email = `rls-${tag}-${Date.now()}@meet4weed.test`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);

    const db = createClient(URL!, PUBLISHABLE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    return { id: data.user.id, email, db };
  }

  beforeAll(async () => {
    admin = createClient(URL!, SECRET!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    alice = await makeMember("alice");
    bob = await makeMember("bob");
  }, 60_000);

  afterAll(async () => {
    // The cascade from auth.users removes the profile rows too.
    for (const member of [alice, bob]) {
      if (member?.id) await admin.auth.admin.deleteUser(member.id);
    }
  }, 60_000);

  it("creates exactly one profile per signup, with a placeholder handle", async () => {
    const { data, error } = await alice.db
      .from("profiles")
      .select("id, handle, status")
      .eq("id", alice.id)
      .single();

    expect(error).toBeNull();
    expect(data!.handle).toMatch(/^member_[0-9a-f]{12}$/);
    expect(data!.status).toBe("unverified");
  });

  it("lets a member read the whole directory", async () => {
    const { data, error } = await alice.db.from("profiles").select("id").in("id", [alice.id, bob.id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("lets a member edit their own bio", async () => {
    const { error } = await alice.db.from("profiles").update({ bio: "mine" }).eq("id", alice.id);
    expect(error).toBeNull();

    const { data } = await alice.db.from("profiles").select("bio").eq("id", alice.id).single();
    expect(data!.bio).toBe("mine");
  });

  it("silently drops an edit aimed at another member's row", async () => {
    // RLS filters the row out of the UPDATE's scope, so this is a no-op rather
    // than an error. The assertion that matters is Bob's bio afterwards.
    await alice.db.from("profiles").update({ bio: "hacked" }).eq("id", bob.id);

    const { data } = await bob.db.from("profiles").select("bio").eq("id", bob.id).single();
    expect(data!.bio).toBeNull();
  });

  it("refuses to let a member promote their own status", async () => {
    const { error } = await alice.db
      .from("profiles")
      .update({ status: "verified" })
      .eq("id", alice.id);

    // 42501 — permission denied for column. The column grant, not a policy.
    expect(error?.code).toBe("42501");

    const { data } = await alice.db.from("profiles").select("status").eq("id", alice.id).single();
    expect(data!.status).toBe("unverified");
  });

  it("refuses to let a member set their own card expiry", async () => {
    const { error } = await alice.db
      .from("profiles")
      .update({ card_expires_on: "2099-01-01" })
      .eq("id", alice.id);

    expect(error?.code).toBe("42501");

    const { data } = await alice.db
      .from("profiles")
      .select("card_expires_on")
      .eq("id", alice.id)
      .single();
    expect(data!.card_expires_on).toBeNull();
  });

  it("refuses to let a member mint a second profile", async () => {
    const { error } = await alice.db
      .from("profiles")
      .insert({ id: crypto.randomUUID(), handle: "sockpuppet" });

    expect(error).not.toBeNull();
  });

  it("refuses to let a member delete their row to escape a suspension", async () => {
    await alice.db.from("profiles").delete().eq("id", alice.id);

    const { data } = await admin.from("profiles").select("id").eq("id", alice.id).maybeSingle();
    expect(data).not.toBeNull();
  });

  it("shows nothing at all to a signed-out visitor", async () => {
    const anon = createClient(URL!, PUBLISHABLE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await anon.from("profiles").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("rejects a handle that is not url-safe and lowercase", async () => {
    const { error } = await alice.db
      .from("profiles")
      .update({ handle: "Ryder.420" })
      .eq("id", alice.id);

    // 23514 — check constraint violation on profiles_handle_format.
    expect(error?.code).toBe("23514");
  });

  it("rejects a duplicate handle with the code the UI maps to plain language", async () => {
    await alice.db.from("profiles").update({ handle: "ryder" }).eq("id", alice.id);

    const { error } = await bob.db.from("profiles").update({ handle: "ryder" }).eq("id", bob.id);

    expect(error?.code).toBe("23505");
  });

  it("lets service_role write the columns members cannot", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ status: "verified", card_expires_on: "2027-01-01" })
      .eq("id", bob.id);

    expect(error).toBeNull();

    const { data } = await admin.from("profiles").select("status").eq("id", bob.id).single();
    expect(data!.status).toBe("verified");
  });
});
