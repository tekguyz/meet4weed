/** @vitest-environment node
 *
 *  Issue #71 — the password check before a delete. It must answer from the
 *  error code, and never leave the throwaway session behind.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const createClient = vi.fn(() => ({ auth: { signInWithPassword, signOut } }));

vi.mock("@supabase/supabase-js", () => ({ createClient: () => createClient() }));

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
});

describe("confirmPassword", () => {
  it("says ok for the right password, and signs the check's own session out locally", async () => {
    const { confirmPassword } = await import("@/lib/auth/confirm-password");

    expect(await confirmPassword("a@meet4weed.test", "right")).toBe("ok");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@meet4weed.test", password: "right" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("says wrong for invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const { confirmPassword } = await import("@/lib/auth/confirm-password");

    expect(await confirmPassword("a@meet4weed.test", "nope")).toBe("wrong");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("says rate_limited when Auth is refusing sign-ins", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "over_request_rate_limit" } });
    const { confirmPassword } = await import("@/lib/auth/confirm-password");

    expect(await confirmPassword("a@meet4weed.test", "right")).toBe("rate_limited");
  });
});
