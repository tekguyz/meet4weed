/** @vitest-environment node
 *
 *  Issue #39 — the demo door's action. The decision itself is lib/demo/door.ts
 *  and has its own test; this proves the action obeys it, and DEMO-STANDARD
 *  rule 2: a real session is never replaced.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signInAnonymously = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signInAnonymously, signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => "admin-client" }));

const enabled = vi.fn();
vi.mock("@/lib/server-env", () => ({ demoModeEnabled: () => enabled() }));

const claimVisitor = vi.fn();
vi.mock("@/lib/demo/limits", () => ({ demoLimitsFromEnv: () => ({ claimVisitor }) }));

const prepareVisitor = vi.fn();
vi.mock("@/lib/demo/visitor", () => ({ prepareVisitor: (...args: unknown[]) => prepareVisitor(...args) }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }) }));

/** redirect() throws in Next; the stand-in does too, so nothing after it runs. */
class Redirected extends Error {
  constructor(public to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

async function press() {
  const { enterDemo } = await import("@/app/demo-actions");
  try {
    return await enterDemo(null, new FormData());
  } catch (error) {
    if (error instanceof Redirected) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
  signInAnonymously.mockReset().mockResolvedValue({ data: { user: { id: "visitor-1" } }, error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  enabled.mockReset().mockReturnValue(true);
  claimVisitor.mockReset().mockResolvedValue({ ipAllowed: true, globalAllowed: true });
  prepareVisitor.mockReset().mockResolvedValue({ ok: true });
});

describe("enterDemo", () => {
  it("leaves a signed-in member signed in as themselves and sends them home", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "real-member" } } });
    expect(await press()).toEqual({ redirectedTo: "/" });
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(claimVisitor).not.toHaveBeenCalled();
  });

  it("creates nothing when the flag is off, and counts nothing", async () => {
    enabled.mockReturnValue(false);
    const result = await press();
    expect(result).toMatchObject({ ok: false });
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(claimVisitor).not.toHaveBeenCalled();
  });

  it("says busy, and creates nothing, when a limit is full", async () => {
    claimVisitor.mockResolvedValue({ ipAllowed: false, globalAllowed: true });
    expect(await press()).toEqual({ ok: false, message: "The demo is busy. Try again in a few minutes." });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("counts the caller's own IP, not the proxy's", async () => {
    await press();
    expect(claimVisitor).toHaveBeenCalledWith("1.2.3.4", expect.any(Date));
  });

  it("signs in a new visitor, makes them a demo member and opens the sesh feed", async () => {
    expect(await press()).toEqual({ redirectedTo: "/seshes" });
    expect(prepareVisitor).toHaveBeenCalledWith("admin-client", "visitor-1", expect.any(String));
  });

  it("signs a half-made visitor back out rather than dropping them on onboarding", async () => {
    prepareVisitor.mockResolvedValue({ ok: false, error: "profile: 42501" });
    const result = await press();
    expect(result).toMatchObject({ ok: false });
    expect(signOut).toHaveBeenCalled();
  });
});
