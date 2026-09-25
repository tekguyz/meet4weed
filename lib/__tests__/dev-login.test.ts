/** @vitest-environment node */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEV_LOGIN_EMAIL, ensureDevAccount, ensureDevPassword } from "@/lib/dev-login";

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

describe("ensureDevAccount", () => {
  it("signs straight in when the account exists", async () => {
    const f = fakes({ signIn: [{ error: null }] });
    await expect(ensureDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
    expect(f.signIn).toHaveBeenCalledWith({ email: DEV_LOGIN_EMAIL, password: "pw" });
    expect(f.admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a confirmed account when it is missing, then signs in", async () => {
    const f = fakes({ signIn: [bad, { error: null }] });
    await expect(ensureDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
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
    await expect(ensureDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({ ok: true });
    expect(f.admin.updateUserById).toHaveBeenCalledWith("dev-id", { password: "pw", email_confirm: true });
  });

  it("reports the error when sign-in still fails", async () => {
    const f = fakes({ signIn: [bad, bad] });
    await expect(ensureDevAccount(f.session, () => f.adminClient, "pw")).resolves.toEqual({
      ok: false,
      error: "Invalid login credentials",
    });
  });
});
