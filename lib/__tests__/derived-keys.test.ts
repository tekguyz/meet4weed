/** @vitest-environment node
 *
 *  `deriveKey` moved out of the verification unit so the invite token can use
 *  it too (Plan 04). These vectors were computed from the old location and are
 *  pinned here: if the secret, the salt, the label or the length ever changes,
 *  every challenge token and every encrypted card image already in flight stops
 *  verifying. The move must not touch a single byte.
 */
import { describe, expect, it } from "vitest";
import { deriveKey } from "@/lib/derived-keys";
import { verifyChallengeToken } from "@/lib/verification/challenge-token";
import { CHALLENGES } from "@/lib/verification/challenges";

const SECRET = Buffer.alloc(32, 7).toString("base64");

describe("deriveKey", () => {
  it("still produces the bytes it produced before the move", () => {
    expect(deriveKey(SECRET, "image").toString("hex")).toBe(
      "8bb28b9ec1016545e5c94fffa7b28cf7947e27e190f4923502e7c2894bc11e14",
    );
    expect(deriveKey(SECRET, "challenge").toString("hex")).toBe(
      "9282de037315049d651fd60652d3acf5045b119e7fac6cd07453317cfdb75c79",
    );
  });

  it("gives each purpose an independent key", () => {
    expect(deriveKey(SECRET, "image").equals(deriveKey(SECRET, "challenge"))).toBe(false);
    expect(deriveKey(SECRET, "invite").equals(deriveKey(SECRET, "challenge"))).toBe(false);
    expect(deriveKey(SECRET, "invite").equals(deriveKey(SECRET, "image"))).toBe(false);
  });

  it("refuses a secret shorter than 32 bytes", () => {
    expect(() => deriveKey(Buffer.alloc(16).toString("base64"), "image")).toThrow(/32 bytes/);
  });
});

describe("tokens minted before the move", () => {
  it("still verify after it", () => {
    // Minted against lib/verification/keys.ts for member-a at t below.
    const token =
      "eyJtIjoibWVtYmVyLWEiLCJjIjoxLCJ0IjoxODAwMDAwMDAwMDAwfQ.OW_lV1Sq2aBHn-e27Tv6Q_H3AXp_NBGA20fY7rqtMhg";
    expect(verifyChallengeToken(SECRET, token, "member-a", 1_800_000_060_000)).toBe(CHALLENGES[1]);
  });
});
