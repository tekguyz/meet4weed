import { describe, expect, it } from "vitest";
import { canBrowse, expiryBanner, frameAccess, memberAccess } from "@/lib/member/gate";

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

// Issue #52: the bell and the notification feed open for exactly these.
describe("canBrowse", () => {
  it.each([
    ["full", true],
    ["read_only", true],
    ["pending", false],
    ["unverified", false],
    ["suspended", false],
  ] as const)("%s → %s", (access, expected) => {
    expect(canBrowse(access)).toBe(expected);
  });
});

describe("frameAccess", () => {
  const ACCESS = ["full", "read_only", "pending", "unverified", "suspended"] as const;

  it.each([
    ["full", ["seshes", "mine", "new", "me"], "/seshes"],
    ["read_only", ["seshes", "mine", "me"], "/seshes"],
    ["pending", ["me"], "standing"],
    ["unverified", ["me"], "standing"],
    ["suspended", ["me"], "standing"],
  ] as const)("%s shows %j and sends / to %s", (access, tabs, home) => {
    for (const isAdmin of [false, true]) {
      expect(frameAccess(access, isAdmin)).toEqual({ tabs, home, adminLink: isAdmin });
    }
  });

  /** Admin is a row inside Me, never a tab, and never a way past the card gate. */
  it.each(ACCESS)("gives an admin who is %s no extra tab", (access) => {
    expect(frameAccess(access, true).tabs).toEqual(frameAccess(access, false).tabs);
  });

  it.each(ACCESS)("always shows Me to a member who is %s, last", (access) => {
    expect(frameAccess(access, false).tabs.at(-1)).toBe("me");
  });
});
