/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { DEMO_BUSY, DEMO_OFF, doorVerdict } from "@/lib/demo/door";
import { visitorHandle } from "@/lib/demo/visitor";

describe("doorVerdict", () => {
  it("is closed when the flag is off, whatever the limits say", () => {
    expect(doorVerdict({ enabled: false, ipAllowed: true, globalAllowed: true })).toEqual({ open: false, message: DEMO_OFF });
  });

  it("is open when the flag is on and both limits are clear", () => {
    expect(doorVerdict({ enabled: true, ipAllowed: true, globalAllowed: true })).toEqual({ open: true });
  });

  it("is busy when this IP has had its five", () => {
    expect(doorVerdict({ enabled: true, ipAllowed: false, globalAllowed: true })).toEqual({ open: false, message: DEMO_BUSY });
  });

  it("is busy when the hour's hundred are gone", () => {
    expect(doorVerdict({ enabled: true, ipAllowed: true, globalAllowed: false })).toEqual({ open: false, message: DEMO_BUSY });
  });
});

describe("visitorHandle", () => {
  it("is visitor_ and six lowercase letters, inside the handle format", () => {
    const handle = visitorHandle();
    expect(handle).toMatch(/^visitor_[a-z]{6}$/);
    expect(handle).toMatch(/^[a-z0-9_]{3,20}$/);
  });

  it("differs from one visitor to the next", () => {
    const handles = new Set(Array.from({ length: 50 }, () => visitorHandle()));
    expect(handles.size).toBeGreaterThan(45);
  });
});
