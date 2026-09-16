/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/lib/verification/challenges";
import { CHALLENGE_TTL_MS, issueChallenge, verifyChallengeToken } from "@/lib/verification/challenge-token";

const SECRET = Buffer.alloc(32, 3).toString("base64");
const NOW = 1_800_000_000_000;

describe("challenge tokens", () => {
  it("returns the challenge it was issued with", () => {
    const { challenge, token } = issueChallenge(SECRET, "member-a", NOW, () => 2);
    expect(challenge).toBe(CHALLENGES[2]);
    expect(verifyChallengeToken(SECRET, token, "member-a", NOW + 60_000)).toBe(CHALLENGES[2]);
  });

  it("belongs to one member", () => {
    const { token } = issueChallenge(SECRET, "member-a", NOW);
    expect(verifyChallengeToken(SECRET, token, "member-b", NOW)).toBeNull();
  });

  it("expires after 15 minutes", () => {
    const { token } = issueChallenge(SECRET, "member-a", NOW);
    expect(verifyChallengeToken(SECRET, token, "member-a", NOW + CHALLENGE_TTL_MS + 1)).toBeNull();
  });

  it("cannot be edited to choose an easier challenge", () => {
    const { token } = issueChallenge(SECRET, "member-a", NOW, () => 0);
    const [body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, c: 5 })).toString("base64url");
    expect(verifyChallengeToken(SECRET, `${forged}.${sig}`, "member-a", NOW)).toBeNull();
  });

  it("rejects garbage without throwing", () => {
    for (const bad of ["", "abc", "a.b", "..", "e30.e30"]) {
      expect(verifyChallengeToken(SECRET, bad, "member-a", NOW)).toBeNull();
    }
  });
});
