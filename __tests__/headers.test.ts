/** @vitest-environment node
 *
 *  Plan 04 puts an invite token in a URL path. Without a Referrer-Policy the
 *  browser sends the whole URL — token included — to any site the visitor
 *  clicks through to. The policy is configured once, for every path, so a new
 *  route cannot miss it.
 */
import { describe, expect, it } from "vitest";
import nextConfig, { REFERRER_POLICY } from "@/next.config";

describe("Referrer-Policy", () => {
  it("is strict-origin-when-cross-origin", () => {
    expect(REFERRER_POLICY).toBe("strict-origin-when-cross-origin");
  });

  it("is served on every path", async () => {
    const rules = await nextConfig.headers!();
    const match = rules.find((r) => r.source === "/:path*");
    expect(match?.headers).toContainEqual({ key: "Referrer-Policy", value: REFERRER_POLICY });
  });
});
