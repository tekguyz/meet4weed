import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("resolves the @ alias", async () => {
    const mod = await import("@/lib/env");
    expect(mod.APP_NAME).toBe("Meet4Weed");
  });
});
