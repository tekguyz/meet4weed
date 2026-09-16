/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { serverEnv } from "@/lib/server-env";

const COMPLETE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_value_that_must_not_leak",
  ANTHROPIC_API_KEY: "anthropic-value-that-must-not-leak",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "upstash-token",
  RESEND_API_KEY: "re_value",
  VERIFICATION_SECRET: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "c".repeat(40),
  OWNER_ALERT_EMAIL: "owner@example.com",
};

describe("serverEnv", () => {
  it("applies the documented defaults", () => {
    const env = serverEnv(COMPLETE);
    expect(env.VISION_DAILY_CEILING).toBe(50);
    expect(env.VERIFY_MEMBER_DAILY_LIMIT).toBe(3);
    expect(env.VERIFY_IP_DAILY_LIMIT).toBe(10);
  });

  it("names what is missing and never prints a value", () => {
    const { ANTHROPIC_API_KEY: _a, ...rest } = COMPLETE;
    const broken = { ...rest, VERIFICATION_SECRET: "c2hvcnQ=" };
    let message = "";
    try {
      serverEnv(broken);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).toContain("VERIFICATION_SECRET");
    expect(message).not.toContain("sb_secret_value_that_must_not_leak");
    expect(message).not.toContain("c2hvcnQ=");
  });
});
