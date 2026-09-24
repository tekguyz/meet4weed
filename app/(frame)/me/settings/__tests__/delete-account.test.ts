/** @vitest-environment node
 *
 *  Issue #71 — Settings → Delete account. The password is checked before
 *  anything is touched, and a refused check deletes nothing. The delete itself
 *  is proved against the real project in
 *  supabase/tests/__tests__/delete-account.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn();
const confirmPassword = vi.fn();
const deleteMemberAccount = vi.fn();
const adminClient = { tag: "service" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));
vi.mock("@/lib/auth/confirm-password", () => ({
  confirmPassword: (email: string, password: string) => confirmPassword(email, password),
}));
vi.mock("@/lib/account/delete", () => ({
  deleteMemberAccount: (db: unknown, id: string) => deleteMemberAccount(db, id),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

function form(password?: string) {
  const fd = new FormData();
  if (password !== undefined) fd.set("password", password);
  return fd;
}

async function deleteAccount(fd: FormData) {
  const { deleteAccount } = await import("@/app/(frame)/me/settings/actions");
  return deleteAccount(null, fd);
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1", email: "leaver@meet4weed.test" } } });
  signOut.mockReset().mockResolvedValue({ error: null });
  confirmPassword.mockReset().mockResolvedValue("ok");
  deleteMemberAccount.mockReset().mockResolvedValue(undefined);
  redirect.mockClear();
});

describe("deleteAccount", () => {
  it("refuses a wrong password and deletes nothing", async () => {
    confirmPassword.mockResolvedValue("wrong");

    const result = await deleteAccount(form("not-it"));

    expect(confirmPassword).toHaveBeenCalledWith("leaver@meet4weed.test", "not-it");
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: "That password is not right." } });
    expect(deleteMemberAccount).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("asks for the password when none is typed, without checking it", async () => {
    const result = await deleteAccount(form(""));

    expect(result).toMatchObject({ ok: false, fieldErrors: { password: "Type your password to confirm." } });
    expect(confirmPassword).not.toHaveBeenCalled();
    expect(deleteMemberAccount).not.toHaveBeenCalled();
  });

  it("says to wait when sign-in checks are rate limited, and deletes nothing", async () => {
    confirmPassword.mockResolvedValue("rate_limited");

    const result = await deleteAccount(form("right-one"));

    expect(result).toMatchObject({ ok: false, message: "Too many tries. Wait a few minutes, then try again." });
    expect(deleteMemberAccount).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteAccount(form("right-one"));

    expect(result).toEqual({ ok: false, message: "Sign in again to continue." });
    expect(deleteMemberAccount).not.toHaveBeenCalled();
  });

  it("deletes the signed-in member with the service client, signs out, and lands on login", async () => {
    await expect(deleteAccount(form("right-one"))).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(deleteMemberAccount).toHaveBeenCalledWith(adminClient, "user-1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("stays on the page with a message when the delete fails", async () => {
    deleteMemberAccount.mockRejectedValue(new Error("storage refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteAccount(form("right-one"));

    expect(result).toEqual({ ok: false, message: "Could not delete your account. Try again." });
    expect(signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
