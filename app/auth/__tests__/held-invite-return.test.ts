/** @vitest-environment node
 *
 *  Plan 04, ticket #31 — the return trip.
 *
 *  Somebody with no account pressed an invite button. The token went into a
 *  short-lived cookie and they were sent to make an account. These two seams
 *  are what brings them back to the invite page so they can press it a
 *  second time.
 *
 *  THE RETURN SPENDS NOTHING. It is a redirect, and a redirect never spends
 *  a use — the second press does. A test below reads both source files and
 *  holds that.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const signInWithPassword = vi.fn();
const heldInvitePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, signInWithPassword } }),
}));

vi.mock("@/lib/sesh/held-invite", () => ({ heldInvitePath: () => heldInvitePath() }));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const ROOT = path.resolve(import.meta.dirname, "../../..");
const INVITE = "/invite/PpaiTkHuLPo-OB89Ah3ZeQ.6yPmx7lbcULwWa1dDbwPCenK0GxHMYy1yKjkG5";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  heldInvitePath.mockResolvedValue(null);
});

describe("confirming an emailed sign-up link", () => {
  async function confirm(type: string) {
    const { confirmEmailLink } = await import("@/app/auth/actions/email-link");
    await expect(
      confirmEmailLink(form({ token_hash: "hash", type })),
    ).rejects.toThrow("NEXT_REDIRECT");
  }

  it("lands on the waiting invite instead of the home screen", async () => {
    heldInvitePath.mockResolvedValue(INVITE);

    await confirm("email");

    expect(redirect).toHaveBeenCalledWith(INVITE);
  });

  it("lands on the home screen when no link is waiting", async () => {
    await confirm("email");

    expect(redirect).toHaveBeenCalledWith("/");
  });

  /** A password reset is not a sign-up. Sending somebody mid-reset to an
   *  invite page would leave them with no new password. */
  it("never diverts a password reset", async () => {
    heldInvitePath.mockResolvedValue(INVITE);

    await confirm("recovery");

    expect(redirect).toHaveBeenCalledWith("/login/new-password");
  });

  it("does not look for a waiting link when the token is refused", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    heldInvitePath.mockResolvedValue(INVITE);

    await confirm("email");

    expect(redirect).toHaveBeenCalledWith("/login?error=link_invalid");
    expect(heldInvitePath).not.toHaveBeenCalled();
  });
});

describe("signing in instead of signing up", () => {
  async function signIn(next?: string) {
    const { signInWithPassword: action } = await import("@/app/auth/actions/sign-in");
    await expect(
      action({ email: "a@b.test", password: "hunter2", next }),
    ).rejects.toThrow("NEXT_REDIRECT");
  }

  /** They were sent to sign UP, but they already had an account. The link
   *  should still be there afterwards. */
  it("lands on the waiting invite", async () => {
    heldInvitePath.mockResolvedValue(INVITE);

    await signIn();

    expect(redirect).toHaveBeenCalledWith(INVITE);
  });

  /** Where they were actually going wins. A waiting invite is a fallback,
   *  not a hijack. */
  it("leaves an explicit destination alone", async () => {
    heldInvitePath.mockResolvedValue(INVITE);

    await signIn("/seshes/mine");

    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  it("lands on the home screen when no link is waiting", async () => {
    await signIn();

    expect(redirect).toHaveBeenCalledWith("/");
  });
});

/** NO USE IS EVER SPENT DURING A REDIRECT. Both files above send people back
 *  to the invite page; neither may reach for the thing that spends. The only
 *  caller of redeem_invite in the app is the button's POST. */
describe("the return path", () => {
  it.each(["app/auth/actions/email-link.ts", "app/auth/actions/sign-in.ts"])(
    "%s spends nothing",
    (file) => {
      const source = readFileSync(path.join(ROOT, file), "utf8");

      expect(source).not.toMatch(/redeem_invite|redeemInvite/);
    },
  );
});
