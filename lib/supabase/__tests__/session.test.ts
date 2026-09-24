/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { getAll: () => unknown } }) => {
    // Touch the adapter so a broken one surfaces here rather than in production.
    opts.cookies.getAll();
    return { auth: { getUser } };
  },
}));

describe("updateSession", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  });

  it("lets a signed-out visitor through to /login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/login"));

    expect(res.status).toBe(200);
  });

  it("redirects a signed-out visitor away from a protected route", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/seshes"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("lets a signed-in visitor through to a protected route", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/seshes"));

    expect(res.status).toBe(200);
  });

  it("never redirects an emailed link, which must open signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/auth/confirm?token_hash=x&type=email"));

    expect(res.status).toBe(200);
  });

  it("lets Vercel Cron reach /api/cron without a session; the route checks its own secret", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/api/cron/expiry-sweep"));

    expect(res.status).toBe(200);
  });

  // Issue #68. A person reads what they agree to before they have an account.
  it.each(["/help", "/terms", "/privacy", "/rules"])("lets a signed-out visitor read %s", async (path) => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest(`http://localhost:3000${path}`));

    expect(res.status).toBe(200);
  });

  it("does not open a path that merely starts with a public word", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/lib/supabase/session");

    const res = await updateSession(new NextRequest("http://localhost:3000/helpers"));

    expect(res.status).toBe(307);
  });
});
