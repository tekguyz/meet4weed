/** @vitest-environment node
 *
 *  Issue #70 — the handle rules. A member changes their handle only through
 *  change_handle(): once every 30 days, and never onto a handle another member
 *  gave up in the last 30 days. Prior art: profiles-rls.test.ts.
 *
 *  The 30 days are not waited out. service_role moves the recorded change
 *  back in time, which is the same thing the clock would do.
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

const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";
const DAY_MS = 86_400_000;

type Member = { id: string; db: SupabaseClient };

describe.skipIf(!configured)("handle changes", () => {
  let admin: SupabaseClient;
  let alice: Member;
  let bob: Member;
  // Handles are global, so every run picks its own.
  const run = Date.now().toString(36).slice(-6);
  const h = (name: string) => `${name}_${run}`;

  async function makeMember(tag: string): Promise<Member> {
    const email = `handle-${tag}-${Date.now()}@meet4weed.test`;
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

    return { id: data.user.id, db };
  }

  async function handleOf(member: Member) {
    const { data } = await admin.from("profiles").select("handle").eq("id", member.id).single();
    return data!.handle as string;
  }

  /** Moves every recorded change of a member back by `days`. */
  async function age(member: Member, days: number) {
    const { data } = await admin.from("handle_changes").select("id, changed_at").eq("member_id", member.id);
    for (const row of data ?? []) {
      const at = new Date(Date.parse(row.changed_at as string) - days * DAY_MS).toISOString();
      await admin.from("handle_changes").update({ changed_at: at }).eq("id", row.id);
    }
  }

  beforeAll(async () => {
    admin = createClient(URL!, SECRET!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    alice = await makeMember("alice");
    bob = await makeMember("bob");
  }, 60_000);

  afterAll(async () => {
    // The cascade removes the profiles; the change records keep a null member
    // on purpose, so they are deleted here by handle.
    await admin.from("handle_changes").delete().like("new_handle", `%_${run}`);
    for (const member of [alice, bob]) {
      if (member?.id) await admin.auth.admin.deleteUser(member.id);
    }
  }, 60_000);

  it("refuses a member's direct UPDATE of handle with 42501, and lets service_role make it", async () => {
    const before = await handleOf(alice);

    const { error } = await alice.db.from("profiles").update({ handle: h("direct") }).eq("id", alice.id);
    expect(error?.code).toBe("42501");
    expect(await handleOf(alice)).toBe(before);

    // Differential: the same statement on the same row lands for service_role,
    // so the refusal above is the revoked grant, not a broken column.
    const { error: adminError } = await admin.from("profiles").update({ handle: h("direct") }).eq("id", alice.id);
    expect(adminError).toBeNull();
    expect(await handleOf(alice)).toBe(h("direct"));

    // Back to the placeholder, so the next test is a real first handle.
    await admin.from("profiles").update({ handle: before }).eq("id", alice.id);
  });

  it("allows the first real handle at once", async () => {
    const { error } = await alice.db.rpc("change_handle", { p_handle: h("alice") });

    expect(error).toBeNull();
    expect(await handleOf(alice)).toBe(h("alice"));
  });

  it("treats saving the same handle again as no change", async () => {
    const { error } = await alice.db.rpc("change_handle", { p_handle: h("alice") });
    expect(error).toBeNull();
  });

  it("refuses a second change within 30 days, and says when it becomes possible", async () => {
    const { error } = await alice.db.rpc("change_handle", { p_handle: h("alice2") });

    expect(error?.code).toBe("M4W32");
    const next = Date.parse(error!.details!);
    expect(next).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    expect(next).toBeLessThan(Date.now() + 31 * DAY_MS);
    expect(await handleOf(alice)).toBe(h("alice"));
  });

  it("allows the second change once 30 days have passed", async () => {
    await age(alice, 31);

    const { error } = await alice.db.rpc("change_handle", { p_handle: h("alice2") });

    expect(error).toBeNull();
    expect(await handleOf(alice)).toBe(h("alice2"));
  });

  it("refuses a handle another member holds", async () => {
    const { error } = await bob.db.rpc("change_handle", { p_handle: h("alice2") });
    expect(error?.code).toBe("M4W30");
  });

  it("refuses a released handle to another member for 30 days", async () => {
    // Alice gave up h("alice") in the test above.
    const { error } = await bob.db.rpc("change_handle", { p_handle: h("alice") });

    expect(error?.code).toBe("M4W31");
    expect(await handleOf(bob)).toMatch(/^member_/);
  });

  it("frees a released handle once its 30 days are over", async () => {
    await age(alice, 31);

    const { error } = await bob.db.rpc("change_handle", { p_handle: h("alice") });

    expect(error).toBeNull();
    expect(await handleOf(bob)).toBe(h("alice"));
  });

  it("refuses the reserved placeholder prefix and a bad format", async () => {
    for (const handle of ["member_abc123def456", "Not.Valid", "no"]) {
      await age(bob, 31);
      const { error } = await bob.db.rpc("change_handle", { p_handle: handle });
      expect(error?.code).toBe("M4W33");
    }
  });

  it("is not callable by a signed-out visitor", async () => {
    const anon = createClient(URL!, PUBLISHABLE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await anon.rpc("change_handle", { p_handle: h("anon") });

    expect(error).not.toBeNull();
  });

  it("hides the change record from members", async () => {
    const { data } = await alice.db.from("handle_changes").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
