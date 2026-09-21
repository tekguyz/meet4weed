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

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
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
  return import("@/app/seshes/invite-actions");
}

const NO_POSTGRES_CODES = /M4W\d\d|42501|PGRST|SQLSTATE/;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "member-1" } } });
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

  /** The signed-out path is #31. This one requires an authenticated caller,
   *  and says so rather than pretending the link is broken. */
  it("sends a signed-out visitor to sign in rather than failing the link", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { redeemInvite } = await actions();

    const state = await redeemInvite(null, form({ token: await liveToken() }));

    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/sign in/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});
