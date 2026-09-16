/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { isAddressBlind, toAuthFailure } from "@/lib/auth/auth-errors";
import { safeNext } from "@/lib/auth/safe-next";

describe("toAuthFailure", () => {
  it("maps by code, never by message", () => {
    expect(toAuthFailure({ code: "invalid_credentials", message: "reworded" })).toBe("invalid_credentials");
    expect(toAuthFailure({ code: "email_not_confirmed" })).toBe("email_not_confirmed");
    // Supabase answers a WRONG token with otp_expired too.
    expect(toAuthFailure({ code: "otp_expired" })).toBe("invalid_code");
    expect(toAuthFailure({ code: "over_email_send_rate_limit" })).toBe("email_send_limit");
  });

  it("reports an unmapped code as unknown, and logs it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toAuthFailure({ code: "something_new", message: "x" })).toBe("unknown");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("never lets a per-address failure reach the sign-up or reset form", () => {
    expect(isAddressBlind("email_send_limit")).toBe(false);
    expect(isAddressBlind("unknown")).toBe(false);
    expect(isAddressBlind("weak_password")).toBe(true);
  });
});

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/onboarding?x=1")).toBe("/onboarding?x=1");
  });

  it("refuses anything a browser would read as another origin", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
