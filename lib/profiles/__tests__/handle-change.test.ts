import { describe, expect, it } from "vitest";
import { handleChangeMessage } from "@/lib/profiles/handle-change";

describe("handleChangeMessage (issue #70)", () => {
  it("says a held handle is taken", () => {
    expect(handleChangeMessage({ code: "M4W30" })).toMatch(/taken/i);
  });

  it("treats a unique-key race as taken", () => {
    expect(handleChangeMessage({ code: "23505" })).toMatch(/taken/i);
  });

  it("says a released handle is locked, and why", () => {
    const message = handleChangeMessage({ code: "M4W31" });
    expect(message).toMatch(/30 days/);
    expect(message).toMatch(/given up/i);
  });

  it("says too soon, with the Florida date it becomes possible", () => {
    // 03:00 UTC on 24 October is still 23 October in Florida.
    const message = handleChangeMessage({ code: "M4W32", details: "2026-10-24T03:00:00Z" });
    expect(message).toMatch(/once every 30 days/i);
    expect(message).toContain("October 23, 2026");
  });

  it("still says too soon when the date is missing", () => {
    expect(handleChangeMessage({ code: "M4W32" })).toMatch(/once every 30 days/i);
  });

  it("says a refused format is not allowed", () => {
    expect(handleChangeMessage({ code: "M4W33" })).toMatch(/3–20 characters/);
  });

  it("never shows a raw code or Postgres message", () => {
    const message = handleChangeMessage({ code: "42P01", details: 'relation "profiles" does not exist' });
    expect(message).not.toMatch(/42P01|relation/);
  });
});
