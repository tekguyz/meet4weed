import { describe, expect, it } from "vitest";
import { expiryBanner, memberAccess } from "@/lib/member/gate";

const TODAY = "2026-09-17";

describe("memberAccess", () => {
  it.each([
    [{ status: "verified", cardExpiresOn: "2027-01-01" }, "full"],
    [{ status: "verified", cardExpiresOn: TODAY }, "full"],
    [{ status: "verified", cardExpiresOn: "2026-09-16" }, "read_only"],
    [{ status: "verified", cardExpiresOn: null }, "read_only"],
    [{ status: "expired", cardExpiresOn: "2026-09-01" }, "read_only"],
    [{ status: "pending_review", cardExpiresOn: null }, "pending"],
    [{ status: "unverified", cardExpiresOn: null }, "unverified"],
    [{ status: "suspended", cardExpiresOn: "2027-01-01" }, "suspended"],
  ] as const)("%j is %s", (profile, access) => {
    expect(memberAccess(profile, TODAY)).toBe(access);
  });
});

describe("expiryBanner", () => {
  it("says nothing more than 30 days out", () => {
    expect(expiryBanner({ status: "verified", cardExpiresOn: "2026-10-18" }, TODAY)).toBeNull();
  });

  it("names the date and the days left from 30 days out", () => {
    expect(expiryBanner({ status: "verified", cardExpiresOn: "2026-10-17" }, TODAY)).toBe(
      "Your card expires Oct 17, in 30 days. Renew it to keep full access.",
    );
  });

  it("says today on the day", () => {
    expect(expiryBanner({ status: "verified", cardExpiresOn: TODAY }, TODAY)).toBe(
      "Your card expires today. Renew it to keep full access.",
    );
  });

  it("is not shown to an expired member, who sees the read-only notice instead", () => {
    expect(expiryBanner({ status: "expired", cardExpiresOn: "2026-09-10" }, TODAY)).toBeNull();
  });
});
