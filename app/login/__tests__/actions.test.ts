/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp } }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://meet4weed.vercel.app" }),
}));

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.resetModules();
    signInWithOtp.mockReset();
  });

  function form(email: unknown) {
    const fd = new FormData();
    if (typeof email === "string") fd.set("email", email);
    return fd;
  }

  it("sends a link for a valid address", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const { requestMagicLink } = await import("@/app/login/actions");

    const result = await requestMagicLink(null, form("alex@example.com"));

    expect(result.ok).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "alex@example.com",
      options: { emailRedirectTo: "https://meet4weed.vercel.app/auth/callback" },
    });
  });

  it("lowercases and trims what the user typed", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const { requestMagicLink } = await import("@/app/login/actions");

    await requestMagicLink(null, form("  Alex@Example.COM  "));

    expect(signInWithOtp.mock.calls[0][0].email).toBe("alex@example.com");
  });

  it("rejects a malformed address without calling Supabase", async () => {
    const { requestMagicLink } = await import("@/app/login/actions");

    const result = await requestMagicLink(null, form("not-an-email"));

    expect(result.ok).toBe(false);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not reveal whether an address is registered when Supabase errors", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "User not found" } });
    const { requestMagicLink } = await import("@/app/login/actions");

    const result = await requestMagicLink(null, form("nobody@example.com"));

    // Same shape as success. An attacker must not learn who is a member.
    expect(result.ok).toBe(true);
    expect(result.message).not.toMatch(/not found/i);
  });

  it("returns the same message whether the send succeeded or failed", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const { requestMagicLink } = await import("@/app/login/actions");
    const success = await requestMagicLink(null, form("a@example.com"));

    signInWithOtp.mockResolvedValue({ error: { message: "rate limited" } });
    const failure = await requestMagicLink(null, form("b@example.com"));

    expect(failure.message).toBe(success.message);
  });
});
