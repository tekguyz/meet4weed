/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/lib/verification/challenges";

describe("face challenges", () => {
  // One hand holds the phone and the other holds the card (phone-test finding 3).
  it("never needs a free hand", () => {
    for (const challenge of CHALLENGES) {
      expect(challenge).not.toMatch(/hand|finger|thumb|point|touch|cover|hold/i);
    }
  });

  it("offers enough poses that one cannot be guessed", () => {
    expect(new Set(CHALLENGES).size).toBeGreaterThanOrEqual(6);
  });
});
