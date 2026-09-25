import "server-only";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";

/** The one dev account /api/dev-login signs in. `.test` is a reserved domain,
 *  so the integration-test sweep of `@meet4weed.test` may delete it — the
 *  route creates it again on the next visit. */
export const DEV_LOGIN_EMAIL = "dev@meet4weed.test";

const PASSWORD_KEY = "DEV_LOGIN_PASSWORD";
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/** The dev account's password: the environment's, else the one `.env.local`
 *  already holds (written earlier, not yet reloaded), else a new random one
 *  appended to `.env.local`. Never printed. */
export function ensureDevPassword(envFile: string, fromEnv: string | undefined): string {
  if (fromEnv) return fromEnv;

  const text = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${PASSWORD_KEY}=`));
  // Strip quotes as dotenv does, so this matches what the reload will load.
  const held = line
    ?.slice(PASSWORD_KEY.length + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2");
  if (held) return held;

  const made = randomBytes(24).toString("base64url");
  const sep = text === "" || text.endsWith("\n") ? "" : "\n";
  appendFileSync(envFile, `${sep}${PASSWORD_KEY}=${made}\n`);
  return made;
}

type AuthError = { code?: string; message: string } | null;

/** Structural slices of the two Supabase clients, so tests can pass fakes. */
type SessionClient = {
  auth: {
    signInWithPassword(c: { email: string; password: string }): PromiseLike<{ error: AuthError }>;
  };
};
type AdminClient = {
  auth: {
    admin: {
      createUser(a: { email: string; password: string; email_confirm: boolean }): PromiseLike<{ error: AuthError }>;
      listUsers(p: { page: number; perPage: number }): PromiseLike<{
        data: { users: { id: string; email?: string }[] };
        error: AuthError;
      }>;
      updateUserById(id: string, a: { password: string; email_confirm: boolean }): PromiseLike<{ error: AuthError }>;
    };
  };
};

export type DevLoginResult = { ok: true } | { ok: false; error: string };

/** Signs the dev account in on `session`, whose cookies carry the result.
 *  A first failure means the account is missing or holds another password
 *  (a regenerated `.env.local`): create it, or reset its password, through
 *  the admin client, then sign in once more. The admin client is built only
 *  on that path. This is a real sign-in — RLS applies to what follows. */
export async function signInDevAccount(
  session: SessionClient,
  admin: () => AdminClient,
  password: string,
): Promise<DevLoginResult> {
  const creds = { email: DEV_LOGIN_EMAIL, password };
  const first = await session.auth.signInWithPassword(creds);
  if (!first.error) return { ok: true };
  // Only wrong credentials mean missing or stale. A rate limit or a network
  // error is reported as it is.
  if (first.error.code !== "invalid_credentials") return { ok: false, error: first.error.message };

  const api = admin().auth.admin;
  const created = await api.createUser({ ...creds, email_confirm: true });
  if (created.error?.code === "email_exists") {
    const id = await findUserId(api, DEV_LOGIN_EMAIL);
    if (!id) return { ok: false, error: `${DEV_LOGIN_EMAIL} exists but was not found` };
    const updated = await api.updateUserById(id, { password, email_confirm: true });
    if (updated.error) return { ok: false, error: updated.error.message };
  } else if (created.error) {
    return { ok: false, error: created.error.message };
  }

  const second = await session.auth.signInWithPassword(creds);
  return second.error ? { ok: false, error: second.error.message } : { ok: true };
}

async function findUserId(api: AdminClient["auth"]["admin"], email: string) {
  // The admin API has no lookup by email. The dev project is small; ten
  // pages is a ceiling, not an expectation.
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await api.listUsers({ page, perPage: PAGE_SIZE });
    if (error) return undefined;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < PAGE_SIZE) return undefined;
  }
  return undefined;
}

/** Who the dev account is after sign-in. A verified member by default;
 *  `?as=admin` adds the admin row. Anything else is a member. */
export type DevRole = "member" | "admin";

export function devRoleFrom(param: string | null): DevRole {
  return param === "admin" ? "admin" : "member";
}

const DEV_HANDLE = "dev_member";
const CARD_VALID_DAYS = 365;

/** The writes prepareDevAccount needs, each returning an error message or
 *  null. The route backs it with the admin client (supabaseDevStore); tests
 *  pass a fake. A member cannot write `status` or `card_expires_on` — the
 *  column grants stop them — so these writes must stay service-side. */
export type DevAccountStore = {
  readProfile(id: string): PromiseLike<
    { profile: { handle: string; attestedAt: string | null } | null } | { error: string }
  >;
  updateProfile(id: string, patch: Record<string, string>): PromiseLike<string | null>;
  setAdmin(id: string, on: boolean): PromiseLike<string | null>;
};

/** Walks the dev account through every gate a screen checks: onboarded, a
 *  real handle, a card valid for a year, and an admin only when asked. Runs
 *  on every visit, so an account left unverified, expired, suspended or
 *  recreated by a test sweep is repaired. Keeps a handle and an attestation
 *  it already has. */
export async function prepareDevAccount(
  store: DevAccountStore,
  userId: string,
  role: DevRole,
  today: string,
): Promise<DevLoginResult> {
  const read = await store.readProfile(userId);
  if ("error" in read) return { ok: false, error: read.error };
  if (!read.profile) return { ok: false, error: "The dev account has no profile row" };

  const patch: Record<string, string> = {};
  if (read.profile.handle.startsWith(RESERVED_HANDLE_PREFIX)) patch.handle = DEV_HANDLE;
  if (!read.profile.attestedAt) {
    patch.attested_at = new Date().toISOString();
    patch.terms_version = TERMS_VERSION;
  }
  patch.status = "verified";
  patch.card_expires_on = addDays(today, CARD_VALID_DAYS);

  const updated = await store.updateProfile(userId, patch);
  if (updated) return { ok: false, error: updated };
  const admin = await store.setAdmin(userId, role === "admin");
  return admin ? { ok: false, error: admin } : { ok: true };
}

/** DevAccountStore on the service-role client. */
export function supabaseDevStore(db: SupabaseClient): DevAccountStore {
  return {
    async readProfile(id) {
      const { data, error } = await db
        .from("profiles")
        .select("handle, attested_at")
        .eq("id", id)
        .maybeSingle();
      if (error) return { error: error.message };
      return { profile: data ? { handle: data.handle, attestedAt: data.attested_at } : null };
    },
    async updateProfile(id, patch) {
      const { error } = await db.from("profiles").update(patch).eq("id", id);
      return error?.message ?? null;
    },
    async setAdmin(id, on) {
      const { error } = on
        ? await db.from("admins").upsert({ user_id: id })
        : await db.from("admins").delete().eq("user_id", id);
      return error?.message ?? null;
    },
  };
}

/** Where to send the browser after sign-in: `next` when it resolves to the
 *  request's own origin, else `/`. Checked after parsing, because
 *  `//evil.example` and `/\evil.example` both parse to a foreign host and pass
 *  a `startsWith("/")` check. */
export function safeRedirectTarget(requestUrl: string, next: string | null): URL {
  const { origin } = new URL(requestUrl);
  try {
    const resolved = next ? new URL(next, origin) : null;
    if (resolved && resolved.origin === origin) return resolved;
  } catch {
    // Unparseable — fall through to `/`.
  }
  return new URL("/", origin);
}
