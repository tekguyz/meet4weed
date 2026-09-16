/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

const SECRET = "s".repeat(64);

describe("isAuthorizedCron", () => {
  it("accepts the bearer Vercel Cron sends", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([null, "", SECRET, `Bearer ${SECRET}x`, "Bearer ", `bearer ${SECRET}`])("refuses %j", (header) => {
    expect(isAuthorizedCron(header, SECRET)).toBe(false);
  });
});
