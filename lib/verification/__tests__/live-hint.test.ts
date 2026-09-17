/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { LIVE_CHECK, liveHint } from "@/lib/verification/live-hint";
import { LIVE_HINT_TEXT } from "@/lib/verification/messages";

describe("liveHint", () => {
  it("says the photo is ready when no pre-check fails", () => {
    expect(liveHint([])).toBe(LIVE_HINT_TEXT.ready);
  });

  it("names framing before glare, and glare before blur", () => {
    expect(liveHint(["blurry", "glare", "no_card"])).toBe(LIVE_HINT_TEXT.no_card);
    expect(liveHint(["blurry", "no_face"])).toBe(LIVE_HINT_TEXT.no_face);
    expect(liveHint(["blurry", "glare"])).toBe(LIVE_HINT_TEXT.glare);
    expect(liveHint(["blurry"])).toBe(LIVE_HINT_TEXT.blurry);
  });

  it("checks a small frame a few times a second", () => {
    expect(LIVE_CHECK.longEdge).toBeLessThanOrEqual(400);
    expect(1000 / LIVE_CHECK.intervalMs).toBeGreaterThanOrEqual(2);
  });
});
