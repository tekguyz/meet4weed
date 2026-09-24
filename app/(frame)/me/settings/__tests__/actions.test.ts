/** @vitest-environment node
 *
 *  Issue #65 — the settings saves. Prior art: app/onboarding/__tests__/actions.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, signOut },
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq };
      },
    }),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

/** The columns `authenticated` may UPDATE that this form owns. Handle has its
 *  own page and its own rules (a later ticket). */
const PROFILE_COLUMNS = ["display_name", "bio", "city", "strain_prefs", "method_prefs", "vibe_tags"];

function fullForm() {
  const fd = new FormData();
  fd.set("displayName", "Ryder");
  fd.set("bio", "Indica after 8pm.");
  fd.set("city", "Wilton Manors");
  fd.append("strainPrefs", "indica");
  fd.append("methodPrefs", "flower");
  fd.append("methodPrefs", "vape");
  fd.set("vibeTags", "vinyl, board games");
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  update.mockReset();
  eq.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  redirect.mockClear();
});

describe("updateProfile", () => {
  it("saves every profile field in snake_case and says so", async () => {
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    const result = await updateProfile(null, fullForm());

    expect(result).toEqual({ ok: true, message: "Profile saved." });
    expect(update.mock.calls[0][0]).toEqual({
      display_name: "Ryder",
      bio: "Indica after 8pm.",
      city: "Wilton Manors",
      strain_prefs: ["indica"],
      method_prefs: ["flower", "vape"],
      vibe_tags: ["vinyl", "board games"],
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("sends only granted columns — never handle, status or card_expires_on", async () => {
    const fd = fullForm();
    // A tampered form. The action must not pass these through.
    fd.set("handle", "someone_else");
    fd.set("status", "verified");
    fd.set("cardExpiresOn", "2099-01-01");
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    await updateProfile(null, fd);

    expect(Object.keys(update.mock.calls[0][0]).sort()).toEqual([...PROFILE_COLUMNS].sort());
  });

  it("clears an emptied field to null rather than an empty string", async () => {
    const fd = new FormData();
    fd.set("displayName", "");
    fd.set("bio", "");
    fd.set("city", "");
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    await updateProfile(null, fd);

    expect(update.mock.calls[0][0]).toMatchObject({
      display_name: null,
      bio: null,
      city: null,
      strain_prefs: [],
      method_prefs: [],
      vibe_tags: [],
    });
  });

  it("returns a field error for a bio that is too long, and writes nothing", async () => {
    const fd = fullForm();
    fd.set("bio", "x".repeat(281));
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    const result = await updateProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.bio).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    const result = await updateProfile(null, fullForm());

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not leak a raw Postgres message", async () => {
    eq.mockResolvedValue({ error: { code: "42501", message: "permission denied for table profiles" } });
    const { updateProfile } = await import("@/app/(frame)/me/settings/actions");

    const result = await updateProfile(null, fullForm());

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/permission|profiles/i);
  });
});

describe("signOutEverywhere", () => {
  it("ends every session with Supabase Auth's global scope, then goes to sign-in", async () => {
    const { signOutEverywhere } = await import("@/app/(frame)/me/settings/actions");

    await expect(signOutEverywhere(null)).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("stays on the page with a message when the sign-out fails", async () => {
    signOut.mockResolvedValue({ error: { message: "network" } });
    const { signOutEverywhere } = await import("@/app/(frame)/me/settings/actions");

    const result = await signOutEverywhere(null);

    expect(result.ok).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("shuffleAvatar (issue #69)", () => {
  function current(seed: string | null) {
    const fd = new FormData();
    if (seed !== null) fd.set("currentSeed", seed);
    return fd;
  }

  it("writes a new seed to the member's own row, and nothing else", async () => {
    const { shuffleAvatar } = await import("@/app/(frame)/me/settings/actions");

    const result = await shuffleAvatar(null, current("old-seed"));

    expect(result).toEqual({ ok: true, message: "New avatar saved." });
    const sent = update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent)).toEqual(["avatar_seed"]);
    expect(typeof sent.avatar_seed).toBe("string");
    expect((sent.avatar_seed as string).length).toBeLessThanOrEqual(40);
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("always changes how the avatar looks, from a seed or from the member id", async () => {
    const { avatarLook, sameLook } = await import("@/lib/profiles/avatar");
    const { shuffleAvatar } = await import("@/app/(frame)/me/settings/actions");

    for (const seed of [null, "old-seed", "another"]) {
      for (let i = 0; i < 20; i++) {
        update.mockClear();
        await shuffleAvatar(null, current(seed));
        const next = (update.mock.calls[0][0] as { avatar_seed: string }).avatar_seed;
        expect(sameLook(avatarLook(next, "user-1"), avatarLook(seed, "user-1"))).toBe(false);
      }
    }
  });

  it("asks a signed-out visitor to sign in and writes nothing", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { shuffleAvatar } = await import("@/app/(frame)/me/settings/actions");

    const result = await shuffleAvatar(null, current(null));

    expect(result).toEqual({ ok: false, message: "Sign in again to continue." });
    expect(update).not.toHaveBeenCalled();
  });

  it("says so when the save fails", async () => {
    eq.mockResolvedValue({ error: { code: "42501" } });
    const { shuffleAvatar } = await import("@/app/(frame)/me/settings/actions");

    const result = await shuffleAvatar(null, current(null));

    expect(result).toEqual({ ok: false, message: "Could not save that. Try again." });
  });
});
