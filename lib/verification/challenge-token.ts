import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { CHALLENGES } from "@/lib/verification/challenges";
import { deriveKey } from "@/lib/verification/keys";

/**
 * The server chooses the challenge when the member reaches the face step and
 * signs it. A client that picked its own challenge could prepare a photo in
 * advance, which is the one thing the challenge exists to prevent.
 *
 * Token: base64url(JSON {m: memberId, c: index, t: issuedAtMs}) "." base64url(HMAC-SHA256).
 */
export const CHALLENGE_TTL_MS = 15 * 60 * 1000;

function sign(secret: string, body: string): string {
  return createHmac("sha256", deriveKey(secret, "challenge")).update(body).digest("base64url");
}

export function issueChallenge(
  secret: string,
  memberId: string,
  now: number = Date.now(),
  pick: (n: number) => number = randomInt,
): { challenge: string; token: string } {
  const c = pick(CHALLENGES.length);
  const body = Buffer.from(JSON.stringify({ m: memberId, c, t: now })).toString("base64url");
  return { challenge: CHALLENGES[c], token: `${body}.${sign(secret, body)}` };
}

export function verifyChallengeToken(
  secret: string,
  token: string,
  memberId: string,
  now: number = Date.now(),
): string | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;

  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: { m?: unknown; c?: unknown; t?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.m !== memberId || typeof payload.t !== "number" || typeof payload.c !== "number") return null;
  if (now - payload.t > CHALLENGE_TTL_MS || payload.t > now + 60_000) return null;
  return CHALLENGES[payload.c] ?? null;
}
