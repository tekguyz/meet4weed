/** @vitest-environment node
 *
 *  Plan 04, ticket #30 — the invite actions.
 *
 *  These have three jobs: turn a database refusal into something a person can
 *  act on, keep the token out of the database, and count presses per IP. The
 *  refusals themselves are proved against the real project in
 *  supabase/tests/__tests__/invite-rls.test.ts.
 *
 *  A raw "M4W19" on screen is a bug, not an error message.
 *
 *  Runs in CI: Supabase, Upstash and next/headers are all mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { INVITE_FAILED } from "@/lib/sesh/invites";

const getUser = vi.fn();
const rpc = vi.fn();
const claimRedemption = vi.fn();
const headerGet = vi.fn();
const cookieSet = vi.fn();
const cookieDelete = vi.fn();

/** The caller's own profile row, read after a successful claim to pick
 *  between the sesh and the held screen. `verified` unless a test says
 *  otherwise, because that is the ordinary member. */
const profileStatus = vi.fn(() => "verified" as string | null);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            const status = profileStatus();
            return { data: status === null ? null : { status }, error: null };
          },
        }),
      }),
    }),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The real one throws to unwind the request. Mocking it as a throw is what
// makes "nothing runs after the redirect" testable.
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: headerGet }),
  cookies: async () => ({ set: cookieSet, delete: cookieDelete }),
}));

vi.mock("@/lib/sesh/invite-limits", () => ({
  inviteLimitsFromEnv: () => ({ claimRedemption }),
}));

// A real 32-byte base64 root, so deriveKey and the token module behave
// exactly as they do in production. No secret from the environment is read.
const SECRET = Buffer.alloc(32, 7).toString("base64");
vi.mock("@/lib/server-env", () => ({
  serverEnv: () => ({ VERIFICATION_SECRET: Buffer.alloc(32, 7).toString("base64") }),
}));

const SESH = "11111111-1111-4111-8111-111111111111";
const INVITE = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function actions() {
  return import("@/app/(frame)/seshes/invite-actions");
}

const NO_POSTGRES_CODES = /M4W\d\d|42501|PGRST|SQLSTATE/;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "member-1" } } });
  profileStatus.mockReturnValue("verified");
  rpc.mockResolvedValue({ data: null, error: null });
  claimRedemption.mockResolvedValue(true);
  headerGet.mockImplementation((name: string) =>
    name === "origin" ? "https://meet4weed.test" : "203.0.113.9",
  );
});

describe("minting", () => {
  it("sends the HASH and never the token", async () => {
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH, uses: "3", days: "7" }));

    const sent = rpc.mock.calls[0][1] as Record<string, unknown>;
    const token = state.url!.split("/invite/")[1];

    expect(sent.p_token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sent.p_token_hash).not.toBe(token);
    // The one that matters: nothing in the payload IS the token.
    expect(JSON.stringify(sent)).not.toContain(token);
  });

  it("passes the uses and an expiry the host picked", async () => {
    const { mintInvite } = await actions();

    await mintInvite(null, form({ seshId: SESH, uses: "4", days: "3" }));

    const sent = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.p_max_uses).toBe(4);
    expect(new Date(sent.p_expires_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("hands the link back once, built on the request origin", async () => {
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH }));

    expect(state.ok).toBe(true);
    expect(state.url).toMatch(/^https:\/\/meet4weed\.test\/invite\/[\w-]+\.[\w-]+$/);
  });

  it("mints a different token every time", async () => {
    const { mintInvite } = await actions();

    const one = await mintInvite(null, form({ seshId: SESH }));
    const two = await mintInvite(null, form({ seshId: SESH }));

    expect(one.url).not.toBe(two.url);
  });

  it("tells a host they cannot make a link for somebody else's sesh", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W20", message: "raised M4W20" } });
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH }));

    expect(state.ok).toBe(false);
    expect(state.message).not.toMatch(NO_POSTGRES_CODES);
    expect(state.url).toBeUndefined();
  });

  it("tells a host they already have five live links", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W21", message: "raised M4W21" } });
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH }));

    expect(state.message).toMatch(/5 live links/i);
    expect(state.message).not.toMatch(NO_POSTGRES_CODES);
  });

  it("refuses an eleventh use before the database is asked", async () => {
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH, uses: "11" }));

    expect(state.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns an unknown SQLSTATE into a plain apology", async () => {
    rpc.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const { mintInvite } = await actions();

    const state = await mintInvite(null, form({ seshId: SESH }));

    expect(state.message).not.toMatch(NO_POSTGRES_CODES);
    expect(state.message).not.toMatch(/duplicate/i);
  });
});

describe("revoking", () => {
  it("says the people who already used it stay", async () => {
    const { revokeInvite } = await actions();

    const state = await revokeInvite(null, form({ inviteId: INVITE, seshId: SESH }));

    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/stays/i);
  });

  it("refuses a link on somebody else's sesh without leaking the code", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W20", message: "raised M4W20" } });
    const { revokeInvite } = await actions();

    const state = await revokeInvite(null, form({ inviteId: INVITE, seshId: SESH }));

    expect(state.ok).toBe(false);
    expect(state.message).not.toMatch(NO_POSTGRES_CODES);
  });
});

describe("redeeming", () => {
  async function liveToken() {
    const { mintInviteToken } = await import("@/lib/sesh/invite-token");
    return mintInviteToken(SECRET);
  }

  it("sends the hash", async () => {
    rpc.mockResolvedValue({ data: SESH, error: null });
    const { redeemInvite } = await actions();
    const token = await liveToken();

    await expect(redeemInvite(null, form({ token }))).rejects.toThrow("NEXT_REDIRECT");

    expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_token_hash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });

  /** REGRESSION. Returning a destination for the page to navigate to left the
   *  successful redeemer reading "that link does not work": the action's reply
   *  re-rendered the invite page, and by then the link they had just spent was
   *  no longer live, so the preview correctly returned nothing. Redirecting
   *  from the action throws, so that render never happens. */
  it("redirects to the sesh rather than rendering the invite page again", async () => {
    rpc.mockResolvedValue({ data: SESH, error: null });
    const { redeemInvite } = await actions();

    await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith(`/seshes/${SESH}`);
  });

  it("does not redirect when the press is refused", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W19", message: "that link does not work" } });
    const { redeemInvite } = await actions();

    const state = await redeemInvite(null, form({ token: await liveToken() }));

    expect(state.ok).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  /** The whole point of the tag: garbage is thrown out without a round trip,
   *  so guessing costs an attacker everything and costs this app nothing. */
  it("throws out a bad signature without asking the database", async () => {
    const { redeemInvite } = await actions();

    const state = await redeemInvite(null, form({ token: "abc.def" }));

    expect(state.message).toBe(INVITE_FAILED);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws out a token with a flipped byte in the random half", async () => {
    const { redeemInvite } = await actions();
    const [body, tag] = (await liveToken()).split(".");
    const flipped = `${body.slice(0, -1)}${body.at(-1) === "A" ? "B" : "A"}.${tag}`;

    const state = await redeemInvite(null, form({ token: flipped }));

    expect(state.message).toBe(INVITE_FAILED);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws out an empty token", async () => {
    const { redeemInvite } = await actions();

    const state = await redeemInvite(null, form({}));

    expect(state.message).toBe(INVITE_FAILED);
    expect(rpc).not.toHaveBeenCalled();
  });

  /** ONE SENTENCE. Expired, used up, revoked, never existed and the wrong
   *  caller all raise M4W19, and a bad tag never reaches the database — so
   *  every path a person can be refused on reads identically. */
  it("renders the identical sentence for every refusal", async () => {
    const { redeemInvite } = await actions();
    const token = await liveToken();

    rpc.mockResolvedValue({ error: { code: "M4W19", message: "that link does not work" } });
    const fromDatabase = await redeemInvite(null, form({ token }));

    rpc.mockClear();
    const fromBadTag = await redeemInvite(null, form({ token: "nope.nope" }));

    claimRedemption.mockResolvedValue(false);
    const fromLimiter = await redeemInvite(null, form({ token }));

    expect(fromDatabase.message).toBe(INVITE_FAILED);
    expect(fromBadTag.message).toBe(INVITE_FAILED);
    expect(fromLimiter.message).toBe(INVITE_FAILED);
  });

  it("counts the press against the caller's IP", async () => {
    rpc.mockResolvedValue({ data: SESH, error: null });
    const { redeemInvite } = await actions();

    await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow();

    expect(claimRedemption).toHaveBeenCalledWith("203.0.113.9", expect.any(String));
  });

  it("takes the first address from a forwarded chain", async () => {
    headerGet.mockImplementation((name: string) =>
      name === "origin" ? "https://meet4weed.test" : "198.51.100.2, 10.0.0.1",
    );
    rpc.mockResolvedValue({ data: SESH, error: null });
    const { redeemInvite } = await actions();

    await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow();

    expect(claimRedemption).toHaveBeenCalledWith("198.51.100.2", expect.any(String));
  });

  it("does not ask the database once the IP is over its allowance", async () => {
    claimRedemption.mockResolvedValue(false);
    const { redeemInvite } = await actions();

    await redeemInvite(null, form({ token: await liveToken() }));

    expect(rpc).not.toHaveBeenCalled();
  });

  /**
   * THE COLD PATH (#31). Somebody with no account presses the button.
   *
   * There is nobody to spend a use FOR, so nothing is spent: no rate-limit
   * slot, no database round trip, no claim. The token is held in a cookie
   * and they are sent to make an account. They come back and press again,
   * and THAT press is the one that spends.
   */
  describe("a press with no account", () => {
    beforeEach(() => {
      getUser.mockResolvedValue({ data: { user: null } });
    });

    it("spends nothing at all", async () => {
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(rpc).not.toHaveBeenCalled();
      expect(claimRedemption).not.toHaveBeenCalled();
    });

    it("sends them to sign up", async () => {
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledWith("/login?mode=sign-up");
    });

    /** The token travels in the cookie and NOWHERE else. A query string, a
     *  path segment or a fragment on this redirect would put a live link in
     *  a server log and in the next page's Referer header. */
    it("puts the token in the cookie and never in the redirect", async () => {
      const { redeemInvite } = await actions();
      const token = await liveToken();

      await expect(redeemInvite(null, form({ token }))).rejects.toThrow("NEXT_REDIRECT");

      expect(cookieSet).toHaveBeenCalledWith("m4w_held_invite", token, expect.any(Object));
      expect(redirect.mock.calls[0][0]).not.toContain(token);
      expect(redirect.mock.calls[0][0]).not.toContain(token.split(".")[0]);
    });

    it("holds it httpOnly, SameSite=Lax and short-lived", async () => {
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      const options = cookieSet.mock.calls[0][2] as Record<string, unknown>;
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.maxAge).toBeLessThanOrEqual(60 * 60);
      expect(options.maxAge).toBeGreaterThan(0);
    });

    /** A dead link is a dead link whether or not anybody is signed in. It
     *  must not become a cookie, and it must not become a trip to sign-up
     *  that ends in the same sentence anyway. */
    it("reads the one sentence for a bad tag, and holds nothing", async () => {
      const { redeemInvite } = await actions();

      const state = await redeemInvite(null, form({ token: "abc.def" }));

      expect(state.message).toBe(INVITE_FAILED);
      expect(cookieSet).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  /**
   * THE SECOND PRESS, by a member whose card nobody has looked at yet.
   *
   * public.redeem_invite() writes the claim anyway — that is what makes a
   * link wait across a multi-day review. private.can_browse() still refuses
   * them the sesh, so the screen has to say so instead of 404ing.
   */
  describe("a claim by a member who cannot browse yet", () => {
    it("still spends the use and writes the claim", async () => {
      profileStatus.mockReturnValue("unverified");
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(rpc).toHaveBeenCalledWith("redeem_invite", expect.any(Object));
    });

    it.each(["unverified", "pending_review"])("sends %s to the held screen", async (status) => {
      profileStatus.mockReturnValue(status);
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledWith("/invite/held");
    });

    /** A STATUS WE COULD NOT READ IS NOT EVIDENCE THEY ARE WAITING. The held
     *  screen tells somebody their card needs approving. Saying that to a
     *  VERIFIED member because one self-read hiccuped is a lie on the one
     *  screen that has to be plainly true, so with nothing to go on the
     *  database gets to answer instead. */
    it("sends a member with no readable status to the sesh, not the held screen", async () => {
      profileStatus.mockReturnValue(null);
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledWith(`/seshes/${SESH}`);
    });

    /** An expired card is read-only, not gone. private.can_browse lets it
     *  through, and so does this. */
    it("sends an expired card to the sesh", async () => {
      profileStatus.mockReturnValue("expired");
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledWith(`/seshes/${SESH}`);
    });

    it("names no sesh in the held destination", async () => {
      profileStatus.mockReturnValue("pending_review");
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect.mock.calls[0][0]).not.toContain(SESH);
    });
  });

  /** The cookie's ONLY job was to survive sign-up. Once they are signed in
   *  it is finished, whatever the press does next — they are holding the
   *  token in the form they just posted, and the claim, if there is one, is
   *  a row on the server. */
  describe("the held cookie", () => {
    it("is cleared once the claim is written", async () => {
      rpc.mockResolvedValue({ data: SESH, error: null });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(cookieDelete).toHaveBeenCalledWith("m4w_held_invite");
    });

    /** A cookie kept through a refusal sits in the browser for half an hour
     *  and bounces their NEXT sign-in to a link that is already dead. */
    it("is cleared when the press is refused too", async () => {
      rpc.mockResolvedValue({ error: { code: "M4W19", message: "that link does not work" } });
      const { redeemInvite } = await actions();

      await redeemInvite(null, form({ token: await liveToken() }));

      expect(cookieDelete).toHaveBeenCalledWith("m4w_held_invite");
    });

    it("is cleared when the IP is over its allowance", async () => {
      claimRedemption.mockResolvedValue(false);
      const { redeemInvite } = await actions();

      await redeemInvite(null, form({ token: await liveToken() }));

      expect(cookieDelete).toHaveBeenCalledWith("m4w_held_invite");
    });

    /** Not on the cold press. That press is the one that SETS it. */
    it("is not cleared by a press with no account", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const { redeemInvite } = await actions();

      await expect(redeemInvite(null, form({ token: await liveToken() }))).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(cookieDelete).not.toHaveBeenCalled();
    });
  });
});
