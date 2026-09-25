import "server-only";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

/** The one dev account /api/dev-login signs in. `.test` is a reserved domain,
 *  so the integration-test sweep of `@meet4weed.test` may delete it — the
 *  route creates it again on the next visit. */
export const DEV_LOGIN_EMAIL = "dev@meet4weed.test";

const KEY = "DEV_LOGIN_PASSWORD";

/** The dev account's password: the environment's, else the one `.env.local`
 *  already holds (written earlier, not yet reloaded), else a new random one
 *  appended to `.env.local`. Never printed. */
export function ensureDevPassword(envFile: string, fromEnv: string | undefined): string {
  if (fromEnv) return fromEnv;

  const text = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${KEY}=`));
  const held = line?.slice(KEY.length + 1).trim();
  if (held) return held;

  const made = randomBytes(24).toString("base64url");
  const sep = text === "" || text.endsWith("\n") ? "" : "\n";
  appendFileSync(envFile, `${sep}${KEY}=${made}\n`);
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
export async function ensureDevAccount(
  session: SessionClient,
  admin: () => AdminClient,
  password: string,
): Promise<DevLoginResult> {
  const creds = { email: DEV_LOGIN_EMAIL, password };
  const first = await session.auth.signInWithPassword(creds);
  if (!first.error) return { ok: true };

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
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await api.listUsers({ page, perPage: 1000 });
    if (error) return undefined;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return undefined;
  }
  return undefined;
}
