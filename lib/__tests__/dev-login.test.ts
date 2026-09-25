/** @vitest-environment node */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEV_LOGIN_EMAIL,
  devRoleFrom,
  ensureDevPassword,
  prepareDevAccount,
  safeRedirectTarget,
  signInDevAccount,
  type DevAccountStore,
} from "@/lib/dev-login";
import { TERMS_VERSION } from "@/lib/legal/terms";

function tempEnvFile(contents?: string) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "m4w-dev-login-")), ".env.local");
  if (contents !== undefined) writeFileSync(file, contents);
  return file;
}

describe("ensureDevPassword", () => {
  it("uses the password already in the environment and leaves the file alone", () => {
    const file = tempEnvFile("A=1\n");
    expect(ensureDevPassword(file, "from-env")).toBe("from-env");
    expect(readFileSync(file, "utf8")).toBe("A=1\n");
  });

  it("reads a password the file already holds but the process has not loaded yet", () => {
    const file = tempEnvFile("A=1\nDEV_LOGIN_PASSWORD=from-file\n");
    expect(ensureDevPassword(file, undefined)).toBe("from-file");
  });

  it("generates a password, appends it on its own line, and returns the same one next time", () => {
    const file = tempEnvFile("A=1");
    const made = ensureDevPassword(file, undefined);
    expect(made.length).toBeGreaterThanOrEqual(32);
    expect(readFileSync(file, "utf8")).toBe(`A=1\nDEV_LOGIN_PASSWORD=${made}\n`);
    expect(ensureDevPassword(file, undefined)).toBe(made);
  });

  it("strips quotes the way the env loader does", () => {
    expect(ensureDevPassword(tempEnvFile('DEV_LOGIN_PASSWORD="quoted"\n'), undefined)).toBe("quoted");
  });

  it("creates the file when there is none", () => {
    const file = tempEnvFile();
    const made = ensureDevPassword(file, "");
    expect(readFileSync(file, "utf8")).toBe(`DEV_LOGIN_PASSWORD=${made}\n`);
  });
});

type Result = { error: { code?: string; message: string } | null };

function fakes(opts: { signIn: Result[]; create?: Result; users?: { id: string; email: string }[] }) {
  const signIn = vi.fn();
  for (const r of opts.signIn) signIn.mockResolvedValueOnce(r);
  const admin = {
    createUser: vi.fn().mockResolvedValue(opts.create ?? { error: null }),
    listUsers: vi.fn().mockResolvedValue({ data: { users: opts.users ?? [] }, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    session: { auth: { signInWithPassword: signIn } },
    adminClient: { auth: { admin } },
    signIn,
    admin,
  };
}

const bad = { error: { code: "invalid_credentials", message: "Invalid login credentials" } };

describe("signInDevAccount", () => {
  it("signs straight in when the account exists", async () => {
    const f = fakes({ signIn: [{ error: null }] });
    await expect(signInDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
    expect(f.signIn).toHaveBeenCalledWith({ email: DEV_LOGIN_EMAIL, password: "pw" });
    expect(f.admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a confirmed account when it is missing, then signs in", async () => {
    const f = fakes({ signIn: [bad, { error: null }] });
    await expect(signInDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
    expect(f.admin.createUser).toHaveBeenCalledWith({
      email: DEV_LOGIN_EMAIL,
      password: "pw",
      email_confirm: true,
    });
    expect(f.signIn).toHaveBeenCalledTimes(2);
  });

  it("resets the password when the account exists with a different one", async () => {
    const f = fakes({
      signIn: [bad, { error: null }],
      create: { error: { code: "email_exists", message: "exists" } },
      users: [
        { id: "other", email: "someone@meet4weed.test" },
        { id: "dev-id", email: DEV_LOGIN_EMAIL },
      ],
    });
    await expect(signInDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
    expect(f.admin.updateUserById).toHaveBeenCalledWith("dev-id", { password: "pw", email_confirm: true });
  });

  it("reports a rate limit as it is, without touching the admin client", async () => {
    const f = fakes({ signIn: [{ error: { code: "over_request_rate_limit", message: "slow down" } }] });
    const admin = vi.fn();
    await expect(signInDevAccount(f.session, admin, "pw")).resolves.toEqual({ ok: false, error: "slow down" });
    expect(admin).not.toHaveBeenCalled();
  });

  it("reports the error when sign-in still fails", async () => {
    const f = fakes({ signIn: [bad, bad] });
    await expect(signInDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({
      ok: false,
      error: "Invalid login credentials",
    });
  });
});

describe("safeRedirectTarget", () => {
  const req = "http://localhost:3000/api/dev-login";
  it.each([
    [null, "http://localhost:3000/"],
    ["/me", "http://localhost:3000/me"],
    ["/sesh/1?tab=a", "http://localhost:3000/sesh/1?tab=a"],
    ["//evil.example", "http://localhost:3000/"],
    ["/\\evil.example", "http://localhost:3000/"],
    ["https://evil.example/", "http://localhost:3000/"],
    ["http://[", "http://localhost:3000/"],
  ])("next=%j lands on %s", (next, want) => {
    expect(safeRedirectTarget(req, next).href).toBe(want);
  });
});

describe("devRoleFrom", () => {
  it.each([
    ["admin", "admin"],
    [null, "member"],
    ["", "member"],
    ["ADMIN", "member"],
    ["owner", "member"],
  ])("as=%j is %s", (param, want) => {
    expect(devRoleFrom(param)).toBe(want);
  });
});

describe("prepareDevAccount", () => {
  const today = "2026-09-25";

  function store(profile: { handle: string; attestedAt: string | null } | null, errors: Partial<Record<keyof DevAccountStore, string>> = {}) {
    return {
      readProfile: vi.fn().mockResolvedValue(errors.readProfile ? { error: errors.readProfile } : { profile }),
      updateProfile: vi.fn().mockResolvedValue(errors.updateProfile ?? null),
      setAdmin: vi.fn().mockResolvedValue(errors.setAdmin ?? null),
    };
  }

  it("finishes a new account: onboarded, a real handle, verified for a year", async () => {
    const s = store({ handle: "member_abc123", attestedAt: null });
    await expect(prepareDevAccount(s, "u1", "member", today)).resolves.toEqual({ ok: true });
    const [id, patch] = s.updateProfile.mock.calls[0];
    expect(id).toBe("u1");
    expect(patch).toMatchObject({
      handle: "dev_member",
      terms_version: TERMS_VERSION,
      status: "verified",
      card_expires_on: "2027-09-25",
    });
    expect(typeof patch.attested_at).toBe("string");
  });

  it("repairs the gates but keeps a handle and attestation it already has", async () => {
    const s = store({ handle: "dev_tester", attestedAt: "2026-09-01T00:00:00Z" });
    await prepareDevAccount(s, "u1", "member", today);
    expect(s.updateProfile.mock.calls[0][1]).toEqual({ status: "verified", card_expires_on: "2027-09-25" });
  });

  it("makes the account an admin only when asked, and removes it otherwise", async () => {
    const s = store({ handle: "dev_tester", attestedAt: "x" });
    await prepareDevAccount(s, "u1", "admin", today);
    expect(s.setAdmin).toHaveBeenCalledWith("u1", true);
    await prepareDevAccount(s, "u1", "member", today);
    expect(s.setAdmin).toHaveBeenLastCalledWith("u1", false);
  });

  it("reports a missing profile without writing anything", async () => {
    const s = store(null);
    await expect(prepareDevAccount(s, "u1", "member", today)).resolves.toEqual({
      ok: false,
      error: "The dev account has no profile row",
    });
    expect(s.updateProfile).not.toHaveBeenCalled();
    expect(s.setAdmin).not.toHaveBeenCalled();
  });

  it.each(["readProfile", "updateProfile", "setAdmin"] as const)("reports a %s error as it is", async (step) => {
    const s = store({ handle: "dev_tester", attestedAt: "x" }, { [step]: "boom" });
    await expect(prepareDevAccount(s, "u1", "admin", today)).resolves.toEqual({ ok: false, error: "boom" });
  });
});
