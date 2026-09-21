import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deriveKey } from "@/lib/derived-keys";

/**
 * An invite token is random bytes plus a signature tag:
 * base64url(16 random bytes) "." base64url(HMAC-SHA256 over that string).
 *
 * The random half is what makes a link unguessable. The tag is what lets the
 * server throw out garbage without touching the database, so guessing costs an
 * attacker everything and costs this app nothing.
 *
 * Pure on purpose: no environment, no I/O, no knowledge of seshes. Everything
 * else about invites lives in Postgres.
 */
const RANDOM_BYTES = 16;

function sign(secret: string, body: string): string {
  return createHmac("sha256", deriveKey(secret, "invite")).update(body).digest("base64url");
}

export function mintInviteToken(secret: string): string {
  const body = randomBytes(RANDOM_BYTES).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export function verifyInviteToken(secret: string, token: string): boolean {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return false;

  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The database stores this, never the token. A holder proves the link by
 *  presenting the token; the row only ever knows its hash. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
