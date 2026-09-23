/** @vitest-environment node
 *
 *  Issue #65 — changing the password while signed in. The same updateUser as
 *  the reset flow's last step, but the member stays on Settings.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, updateUser } }),
}));
vi.mock("@/lib/auth/email-redirect", () => ({ emailLinkTarget: async () => "" }));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  updateUser.mockReset().mockResolvedValue({ error: null });
  redirect.mockClear();
});

describe("changePassword", () => {
  it("updates the password and stays put", async () => {
    const { changePassword } = await import("@/app/auth/actions/recovery");

    const result = await changePassword({ password: "Abcdef1!" });

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "Abcdef1!" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { changePassword } = await import("@/app/auth/actions/recovery");

    expect(await changePassword({ password: "Abcdef1!" })).toEqual({ ok: false, failure: "no_session" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("passes on a weak-password refusal as a failure the form can name", async () => {
    updateUser.mockResolvedValue({ error: { code: "weak_password", message: "weak" } });
    const { changePassword } = await import("@/app/auth/actions/recovery");

    expect(await changePassword({ password: "abc" })).toEqual({ ok: false, failure: "weak_password" });
  });
});

describe("setNewPassword", () => {
  it("still ends the reset flow by going home", async () => {
    const { setNewPassword } = await import("@/app/auth/actions/recovery");

    await expect(setNewPassword({ password: "Abcdef1!" })).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
