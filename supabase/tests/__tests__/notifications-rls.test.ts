/** @vitest-environment node
 *
 *  Issue #50 — who can do what to public.notifications. A member reads their
 *  own rows and sets read_at. Nothing else: no insert, no delete, no other
 *  column. Prior art: handle-change-rls.test.ts.
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
import { NOTIFICATION_TYPES } from "@/lib/notify/events";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const configured = Boolean(URL && PUBLISHABLE && SECRET);

const PASSWORD = "Rls-probe-8f2a1c9d4b7e!";

type Member = { id: string; db: SupabaseClient };

describe.skipIf(!configured)("notifications RLS", () => {
  let admin: SupabaseClient;
  let alice: Member;
  let bob: Member;
  let carol: Member;
  const made: string[] = [];

  async function makeMember(tag: string): Promise<Member> {
    const email = `notify-${tag}-${Date.now()}@meet4weed.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`could not create ${tag}: ${error?.message}`);
    made.push(data.user.id);

    const db = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`could not sign in ${tag}: ${signInError.message}`);

    return { id: data.user.id, db };
  }

  /** A card_expiry row needs no sesh, which keeps these tests off the sesh rules. */
  async function noticeFor(recipient: Member, actor: Member | null = null): Promise<string> {
    const { data, error } = await admin
      .from("notifications")
      .insert({ recipient_id: recipient.id, type: "card_expiry", actor_id: actor?.id ?? null })
      .select("id")
      .single();
    if (error || !data) throw new Error(`could not write a notice: ${error?.code}`);
    return data.id as string;
  }

  async function row(id: string) {
    const { data } = await admin.from("notifications").select("*").eq("id", id).maybeSingle();
    return data as { recipient_id: string; type: string; read_at: string | null; actor_id: string | null } | null;
  }

  beforeAll(async () => {
    admin = createClient(URL!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } });
    alice = await makeMember("alice");
    bob = await makeMember("bob");
    carol = await makeMember("carol");
  }, 60_000);

  afterAll(async () => {
    // The recipient cascade removes every row these members received.
    for (const id of made) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  it("takes every type the code knows, and no other", async () => {
    for (const type of NOTIFICATION_TYPES) {
      const { error } = await admin.from("notifications").insert({ recipient_id: alice.id, type });
      expect(error, type).toBeNull();
    }

    const { error } = await admin.from("notifications").insert({ recipient_id: alice.id, type: "sesh_sold" });
    expect(error?.code).toBe("22P02");
  });

  it("shows a member their own rows and nobody else's", async () => {
    const mine = await noticeFor(alice);
    const theirs = await noticeFor(bob);

    const { data, error } = await alice.db.from("notifications").select("id");

    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(theirs);
  });

  it("refuses a member's INSERT, even one addressed to themselves, and lets service_role make it", async () => {
    const statement = { recipient_id: alice.id, type: "card_expiry" };

    const { error } = await alice.db.from("notifications").insert(statement);
    expect(error?.code).toBe("42501");

    const { error: adminError } = await admin.from("notifications").insert(statement);
    expect(adminError).toBeNull();
  });

  it("refuses a member's DELETE of their own row, and lets service_role make it", async () => {
    const id = await noticeFor(alice);

    // DELETE has no grant, so PostgREST refuses outright rather than matching nothing.
    const { error } = await alice.db.from("notifications").delete().eq("id", id);
    expect(error?.code).toBe("42501");
    expect(await row(id)).not.toBeNull();

    const { error: adminError } = await admin.from("notifications").delete().eq("id", id);
    expect(adminError).toBeNull();
    expect(await row(id)).toBeNull();
  });

  it("lets a member mark their own row read", async () => {
    const id = await noticeFor(alice);
    const at = new Date().toISOString();

    const { error } = await alice.db.from("notifications").update({ read_at: at }).eq("id", id);

    expect(error).toBeNull();
    expect((await row(id))?.read_at).not.toBeNull();
  });

  it("does not let a member mark somebody else's row read", async () => {
    const id = await noticeFor(bob);

    const { error } = await alice.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);

    // The policy hides the row, so the update matches nothing.
    expect(error).toBeNull();
    expect((await row(id))?.read_at).toBeNull();
  });

  it("refuses a member's UPDATE of any column but read_at, and lets service_role make it", async () => {
    const changes = [
      { id: crypto.randomUUID() },
      { recipient_id: bob.id },
      { type: "rsvp_approved" },
      { sesh_id: null },
      { actor_id: bob.id },
      { payload: { forged: true } },
      { created_at: new Date(0).toISOString() },
    ];
    for (const change of changes) {
      const id = await noticeFor(alice);

      const { error } = await alice.db.from("notifications").update(change).eq("id", id);
      expect(error?.code).toBe("42501");
      expect((await row(id))?.recipient_id).toBe(alice.id);

      const { error: adminError } = await admin.from("notifications").update(change).eq("id", id);
      expect(adminError).toBeNull();
    }
  });

  it("keeps the row when the actor's account is deleted, with the actor gone", async () => {
    const id = await noticeFor(alice, carol);

    await admin.auth.admin.deleteUser(carol.id);

    const after = await row(id);
    expect(after).not.toBeNull();
    expect(after?.actor_id).toBeNull();
  });

  it("takes a member's own rows with them when their account is deleted", async () => {
    const id = await noticeFor(bob, alice);

    await admin.auth.admin.deleteUser(bob.id);

    expect(await row(id)).toBeNull();
  });
});
