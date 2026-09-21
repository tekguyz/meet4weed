/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithPassword } from "@/app/auth/actions/sign-in";
import { resendConfirmationLink, signUpWithPassword } from "@/app/auth/actions/sign-up";
import { requestPasswordReset, setNewPassword } from "@/app/auth/actions/recovery";
import { confirmEmailLink } from "@/app/auth/actions/email-link";

type Err = { code: string; message: string } | null;

const state = vi.hoisted(() => ({
  calls: [] as { method: string; args: unknown[] }[],
  error: null as Err,
  signUpSession: null as object | null,
  user: { id: "u1" } as { id: string } | null,
  redirects: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirects.push(to);
    throw new Error("NEXT_REDIRECT");
  },
}));

/** #31: both actions now ask whether an invite link is waiting in a cookie.
 *  Empty here — these tests are about the auth seam, and the waiting-link
 *  behaviour has its own file (app/auth/__tests__/held-invite-return.test.ts). */
vi.mock("@/lib/sesh/held-invite", () => ({ heldInvitePath: async () => null }));

vi.mock("@/lib/auth/email-redirect", () => ({
  emailLinkTarget: async () => "http://localhost:3000/auth/confirm",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const record =
      (method: string, data: () => object = () => ({})) =>
      async (...args: unknown[]) => {
        state.calls.push({ method, args });
        return { data: data(), error: state.error };
      };
    return {
      auth: {
        signInWithPassword: record("signInWithPassword"),
        signUp: record("signUp", () => ({ session: state.signUpSession })),
        signOut: record("signOut"),
        verifyOtp: record("verifyOtp"),
        resend: record("resend"),
        resetPasswordForEmail: record("resetPasswordForEmail"),
        getUser: async () => ({ data: { user: state.user } }),
        updateUser: record("updateUser"),
      },
    };
  },
}));

beforeEach(() => {
  Object.assign(state, { calls: [], error: null, signUpSession: null, user: { id: "u1" }, redirects: [] });
});

const args = (name: string) => state.calls.find((c) => c.method === name)?.args;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("signInWithPassword", () => {
  it("signs in with a normalised email and follows a safe next", async () => {
    await expect(
      signInWithPassword({ email: " Me@Example.COM ", password: "pw", next: "/onboarding" }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(args("signInWithPassword")).toEqual([{ email: "me@example.com", password: "pw" }]);
    expect(state.redirects).toEqual(["/onboarding"]);
  });

  it("refuses an off-site next", async () => {
    await expect(signInWithPassword({ email: "me@example.com", password: "pw", next: "//evil" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(state.redirects).toEqual(["/"]);
  });

  it("returns the failure when Supabase refuses", async () => {
    state.error = { code: "email_not_confirmed", message: "Email not confirmed" };
    await expect(signInWithPassword({ email: "me@example.com", password: "pw" })).resolves.toEqual({
      failure: "email_not_confirmed",
    });
    expect(state.redirects).toEqual([]);
  });

  it("refuses bad input without calling Supabase", async () => {
    await expect(signInWithPassword({ email: "not-an-email", password: "pw" })).resolves.toEqual({
      failure: "invalid_input",
    });
    expect(state.calls).toEqual([]);
  });
});

describe("sign-up", () => {
  it("creates the account without a session, with the link aimed at /auth/confirm", async () => {
    await expect(signUpWithPassword({ email: "a@b.co", password: "pw" })).resolves.toEqual({ ok: true });
    expect(args("signUp")).toEqual([
      { email: "a@b.co", password: "pw", options: { emailRedirectTo: "http://localhost:3000/auth/confirm" } },
    ]);
  });

  it("refuses a session from signUp — that means the confirm gate is off", async () => {
    const log = quiet();
    state.signUpSession = { access_token: "x" };
    await expect(signUpWithPassword({ email: "a@b.co", password: "pw" })).resolves.toEqual({
      ok: false,
      failure: "unknown",
    });
    expect(args("signOut")).toEqual([{ scope: "local" }]);
    log.mockRestore();
  });

  it("shows a weak password, which says nothing about the address", async () => {
    state.error = { code: "weak_password", message: "weak" };
    await expect(signUpWithPassword({ email: "a@b.co", password: "pw" })).resolves.toEqual({
      ok: false,
      failure: "weak_password",
    });
  });

  it("answers a per-address send limit exactly as success", async () => {
    const log = quiet();
    const known = await signUpWithPassword({ email: "member@b.co", password: "pw" });
    state.error = { code: "over_email_send_rate_limit", message: "only after 60 seconds" };
    const limited = await signUpWithPassword({ email: "member@b.co", password: "pw" });
    expect(limited).toEqual(known);
    log.mockRestore();
  });

  it("resends the confirmation link as type signup", async () => {
    await expect(resendConfirmationLink({ email: "a@b.co" })).resolves.toEqual({ ok: true });
    expect(args("resend")).toEqual([
      { type: "signup", email: "a@b.co", options: { emailRedirectTo: "http://localhost:3000/auth/confirm" } },
    ]);
  });
});

describe("password reset", () => {
  it("mails a link aimed at /auth/confirm", async () => {
    await expect(requestPasswordReset({ email: "a@b.co" })).resolves.toEqual({ ok: true });
    expect(args("resetPasswordForEmail")).toEqual(["a@b.co", { redirectTo: "http://localhost:3000/auth/confirm" }]);
  });

  it("answers a per-address failure exactly as success", async () => {
    const log = quiet();
    const unknown = await requestPasswordReset({ email: "nobody@b.co" });
    state.error = { code: "over_email_send_rate_limit", message: "only after 60 seconds" };
    const known = await requestPasswordReset({ email: "member@b.co" });
    expect(known).toEqual(unknown);
    log.mockRestore();
  });

  it("sets the new password on the reset session, then goes home", async () => {
    await expect(setNewPassword({ password: "new-pw" })).rejects.toThrow("NEXT_REDIRECT");
    expect(args("updateUser")).toEqual([{ password: "new-pw" }]);
    expect(state.redirects).toEqual(["/"]);
  });

  it("refuses to set a password with no session", async () => {
    state.user = null;
    await expect(setNewPassword({ password: "new-pw" })).resolves.toEqual({ ok: false, failure: "no_session" });
    expect(args("updateUser")).toBeUndefined();
  });
});

describe("confirmEmailLink — the POST behind /auth/confirm", () => {
  it("verifies a sign-up link by token hash, then goes home", async () => {
    await expect(confirmEmailLink(form({ token_hash: "pkce_abc", type: "email" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(args("verifyOtp")).toEqual([{ token_hash: "pkce_abc", type: "email" }]);
    expect(state.redirects).toEqual(["/"]);
  });

  it("sends a verified reset link to the new-password page", async () => {
    await expect(confirmEmailLink(form({ token_hash: "abc", type: "recovery" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirects).toEqual(["/login/new-password"]);
  });

  it("refuses a magic-link type without calling Supabase", async () => {
    await expect(confirmEmailLink(form({ token_hash: "abc", type: "magiclink" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(state.calls).toEqual([]);
    expect(state.redirects).toEqual(["/login?error=link_invalid"]);
  });

  it("sends a spent or expired link back to /login with a reason", async () => {
    const log = quiet();
    state.error = { code: "otp_expired", message: "Email link is invalid or has expired" };
    await expect(confirmEmailLink(form({ token_hash: "abc", type: "email" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirects).toEqual(["/login?error=link_invalid"]);
    log.mockRestore();
  });
});
