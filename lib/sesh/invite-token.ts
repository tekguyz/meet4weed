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

/**
 * Is this SHAPED like a token? base64url, a dot, base64url, and nothing else.
 *
 * NOT a signature check, and no substitute for one. Only
 * [[verifyInviteToken]] says a token is real. This exists for the one caller
 * that must NOT verify — lib/sesh/held-invite.ts, which carries whatever a
 * cookie held back to the invite page so a tampered token reads the same one
 * sentence as every other dead link. It checks shape only so a junk cookie
 * cannot become a path.
 *
 * It lives here because this module owns the format. A second copy of the
 * rule somewhere else is a second thing to update the day the format moves.
 *
 * 16 random bytes and a SHA-256 tag make a token about 65 characters, so the
 * cap is slack, not a measurement.
 */
const SHAPE = /^[A-Za-z0-9_-]{1,128}\.[A-Za-z0-9_-]{1,128}$/;

export function looksLikeInviteToken(token: string): boolean {
  return SHAPE.test(token);
}

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
