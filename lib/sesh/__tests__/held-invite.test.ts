/** @vitest-environment node
 *
 *  Plan 04, ticket #31 — the cookie that carries an invite across a sign-up.
 *
 *  Everything below is about what this cookie is NOT allowed to be: readable
 *  by a script, sendable from another site, long-lived, or a way to redirect
 *  somebody off this origin.
 *
 *  It does not verify the token's tag, and one test holds that on purpose.
 *  A tampered token must reach the invite page and get the SAME sentence as
 *  an expired one, a revoked one and one that never existed. Rejecting it
 *  here would give it a different ending, and a different ending is the
 *  enumeration signal the one sentence exists to kill.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, get: cookieGet }),
}));

const TOKEN = "PpaiTkHuLPo-OB89Ah3ZeQ.6yPmx7lbcULwWa1dDbwPCenK0GxHMYy1yKjkG5";

async function held() {
  return import("@/lib/sesh/held-invite");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  cookieGet.mockReturnValue(undefined);
});

describe("holding a token", () => {
  it("keeps it out of every script on the page", async () => {
    const { holdInvite, HELD_INVITE_COOKIE } = await held();

    await holdInvite(TOKEN);

    expect(cookieSet).toHaveBeenCalledWith(HELD_INVITE_COOKIE, TOKEN, expect.any(Object));
    expect(cookieSet.mock.calls[0][2].httpOnly).toBe(true);
  });

  /** Lax, not None. The cookie's whole job is to survive this app's own
   *  redirect to sign-up; letting another site's form post carry it is a
   *  capability nothing needs. */
  it("is not sent on another site's request", async () => {
    const { holdInvite } = await held();

    await holdInvite(TOKEN);

    expect(cookieSet.mock.calls[0][2].sameSite).toBe("lax");
  });

  /** It only has to outlive reading an email and picking a password. The
   *  claim that waits days is a row in public.invite_claims, not this. */
  it("dies within the hour", async () => {
    const { holdInvite, HELD_INVITE_MAX_AGE } = await held();

    await holdInvite(TOKEN);

    expect(HELD_INVITE_MAX_AGE).toBeLessThanOrEqual(60 * 60);
    expect(cookieSet.mock.calls[0][2].maxAge).toBe(HELD_INVITE_MAX_AGE);
  });

  it("holds nothing that is not shaped like a token", async () => {
    const { holdInvite } = await held();

    for (const junk of ["", "no-dot", "a.b.c", "../../etc", "tok en.tag", "a.b\n"]) {
      await holdInvite(junk);
    }

    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe("coming back", () => {
  it("points at the invite page the token came from", async () => {
    cookieGet.mockReturnValue({ value: TOKEN });
    const { heldInvitePath } = await held();

    expect(await heldInvitePath()).toBe(`/invite/${encodeURIComponent(TOKEN)}`);
  });

  it("points nowhere when nothing is waiting", async () => {
    const { heldInvitePath } = await held();

    expect(await heldInvitePath()).toBeNull();
  });

  /** A crafted cookie must not become an off-site redirect. None of these
   *  is token-shaped, so every one is refused outright.
   *
   *  Asserted as `toBeNull()` and not as "null OR starts with /invite/",
   *  which was true whatever the code did and proved nothing. */
  it("refuses a value that is not a token, so it can never steer a redirect", async () => {
    const { heldInvitePath } = await held();

    for (const junk of ["//evil.test", "/\\evil.test", "https://evil.test", "..%2F..%2F"]) {
      cookieGet.mockReturnValue({ value: junk });

      expect(await heldInvitePath()).toBeNull();
    }
  });

  /** And if one ever did get past the shape check, invitePath() encodes it
   *  into ONE path segment, so it is still a path on this origin. */
  it("encodes whatever it does carry into a single path segment", async () => {
    cookieGet.mockReturnValue({ value: TOKEN });
    const { heldInvitePath } = await held();

    const path = (await heldInvitePath())!;

    expect(path.startsWith("/invite/")).toBe(true);
    expect(path.slice("/invite/".length)).not.toContain("/");
  });

  /** THE TAG IS NOT CHECKED HERE, and that is the design. A flipped byte
   *  goes back to the invite page and reads the same one sentence as every
   *  other dead link. */
  it("carries a tampered token back to the page that says one sentence", async () => {
    const flipped = `${TOKEN.slice(0, -1)}${TOKEN.at(-1) === "A" ? "B" : "A"}`;
    cookieGet.mockReturnValue({ value: flipped });
    const { heldInvitePath } = await held();

    expect(await heldInvitePath()).toBe(`/invite/${encodeURIComponent(flipped)}`);
  });
});

describe("letting go", () => {
  it("removes the cookie by name", async () => {
    const { releaseHeldInvite, HELD_INVITE_COOKIE } = await held();

    await releaseHeldInvite();

    expect(cookieDelete).toHaveBeenCalledWith(HELD_INVITE_COOKIE);
  });
});
