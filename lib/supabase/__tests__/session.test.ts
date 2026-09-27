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

  // Issue #97. A stranger on the root sees what the app is, at the same URL.
  describe("the landing page", () => {
    it("serves the landing page to a signed-out visitor on /, without a redirect", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const { updateSession } = await import("@/lib/supabase/session");

      const res = await updateSession(new NextRequest("http://localhost:3000/"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/landing");
    });

    it("keeps a query string on the rewrite", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const { updateSession } = await import("@/lib/supabase/session");

      const res = await updateSession(new NextRequest("http://localhost:3000/?utm_source=portfolio"));

      expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/landing?utm_source=portfolio");
    });

    it("leaves / alone for a signed-in member", async () => {
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const { updateSession } = await import("@/lib/supabase/session");

      const res = await updateSession(new NextRequest("http://localhost:3000/"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    });

    it.each(["/seshes", "/seshes/3f1c2b7e-8a44-4f0e-9d6a-2b1f0c9e7a51"])(
      "still sends a signed-out visitor on %s to sign in",
      async (path) => {
        getUser.mockResolvedValue({ data: { user: null } });
        const { updateSession } = await import("@/lib/supabase/session");

        const res = await updateSession(new NextRequest(`http://localhost:3000${path}`));

        expect(res.status).toBe(307);
        const location = new URL(res.headers.get("location")!);
        expect(location.pathname).toBe("/login");
        expect(location.searchParams.get("next")).toBe(path);
      },
    );

    it.each([
      ["signed out", null],
      ["signed in", { id: "user-1" }],
    ])("sends a direct request for the internal route to /, %s", async (_who, user) => {
      getUser.mockResolvedValue({ data: { user } });
      const { updateSession } = await import("@/lib/supabase/session");

      const res = await updateSession(new NextRequest("http://localhost:3000/landing"));

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    });
  });

  // A crawler has no session. Gated, it would read the sign-in page instead.
  it.each(["/robots.txt", "/sitemap.xml"])("lets a crawler read %s signed out", async (path) => {
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
