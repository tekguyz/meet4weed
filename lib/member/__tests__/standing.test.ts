import { describe, expect, it } from "vitest";
import { standing } from "@/lib/member/standing";

const TODAY = "2026-09-17";
const FAR = "2027-06-01";
const SOON = "2026-10-01";
const PAST = "2026-09-01";

const latest = (status: string, decisionReason: string | null = null) => ({ status, decisionReason });

describe("standing", () => {
  it("is suspended above everything else", () => {
    expect(standing({ status: "suspended", cardExpiresOn: FAR }, latest("pending_review"), TODAY)).toEqual({
      kind: "suspended",
    });
  });

  it("is pending when the profile says so", () => {
    expect(standing({ status: "pending_review", cardExpiresOn: null }, null, TODAY)).toEqual({ kind: "pending" });
  });

  it("is pending when the latest submission is waiting, whatever the profile says", () => {
    expect(standing({ status: "unverified", cardExpiresOn: null }, latest("pending_review"), TODAY)).toEqual({
      kind: "pending",
    });
  });

  it("is verified with the date far from expiry", () => {
    expect(standing({ status: "verified", cardExpiresOn: FAR }, latest("approved"), TODAY)).toEqual({
      kind: "verified",
      expiresOn: FAR,
    });
  });

  it("reuses the expiry banner's words inside 30 days", () => {
    expect(standing({ status: "verified", cardExpiresOn: SOON }, null, TODAY)).toEqual({
      kind: "expiring",
      notice: "Your card expires Oct 1, in 14 days. Renew it to keep full access.",
    });
  });

  it("keeps a verified member verified when an old renewal was rejected", () => {
    expect(standing({ status: "verified", cardExpiresOn: FAR }, latest("rejected", "blurry"), TODAY).kind).toBe(
      "verified",
    );
  });

  it.each([
    [{ status: "expired", cardExpiresOn: PAST }],
    [{ status: "verified", cardExpiresOn: PAST }],
  ] as const)("is expired for %j", (profile) => {
    expect(standing(profile, latest("approved"), TODAY)).toEqual({ kind: "expired" });
  });

  it("carries the stored reason for a rejection", () => {
    expect(standing({ status: "unverified", cardExpiresOn: null }, latest("rejected", "Card is not an OMMU card"), TODAY)).toEqual({
      kind: "rejected",
      reason: "Card is not an OMMU card",
    });
  });

  it("carries the stored reason for a retake", () => {
    expect(standing({ status: "unverified", cardExpiresOn: null }, latest("retake_requested", "Too dark"), TODAY)).toEqual({
      kind: "retake",
      reason: "Too dark",
    });
  });

  it("says a renewal was rejected rather than just expired", () => {
    expect(standing({ status: "expired", cardExpiresOn: PAST }, latest("rejected", "Wrong card"), TODAY)).toEqual({
      kind: "rejected",
      reason: "Wrong card",
    });
  });

  it("is lapsed when nobody reviewed the photos in time", () => {
    expect(standing({ status: "unverified", cardExpiresOn: null }, latest("lapsed"), TODAY)).toEqual({ kind: "lapsed" });
  });

  it("is unverified with no submission at all", () => {
    expect(standing({ status: "unverified", cardExpiresOn: null }, null, TODAY)).toEqual({ kind: "unverified" });
  });
});
