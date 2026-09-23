import { describe, expect, it } from "vitest";
import { formatVersion } from "@/lib/app-version";

describe("formatVersion (issue #65)", () => {
  it("adds the short commit, so two deploys of 0.1.0 can be told apart", () => {
    expect(formatVersion("0.1.0", "3d90056abcdef0123456789")).toBe("0.1.0 (3d90056)");
  });

  it("is the bare version where there is no commit, as in local dev", () => {
    expect(formatVersion("0.1.0", undefined)).toBe("0.1.0");
  });
});
