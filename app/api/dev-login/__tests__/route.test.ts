/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => {
    throw new Error("must not touch Supabase outside development");
  },
}));

import { GET } from "@/app/api/dev-login/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/dev-login", () => {
  it.each(["production", "test", ""])("is not found when NODE_ENV is %j", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    const res = await GET(new Request("http://localhost:3000/api/dev-login"));
    expect(res.status).toBe(404);
  });
});
