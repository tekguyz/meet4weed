import "server-only";
import { hkdfSync } from "node:crypto";

export type KeyPurpose = "image" | "challenge";

/** One secret in the environment, one independent key per job. HKDF means a
 *  key recovered from one purpose says nothing about the other. */
export function deriveKey(secret: string, purpose: KeyPurpose): Buffer {
  const root = Buffer.from(secret, "base64");
  if (root.length < 32) throw new Error("VERIFICATION_SECRET must be at least 32 bytes, base64-encoded");
  return Buffer.from(hkdfSync("sha256", root, Buffer.alloc(0), `meet4weed:${purpose}`, 32));
}
