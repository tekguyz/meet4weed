import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deriveKey } from "@/lib/derived-keys";

/**
 * AES-256-GCM, stored as iv (12 bytes) | auth tag (16 bytes) | ciphertext.
 *
 * Supabase already encrypts Storage at rest. This layer is for the other
 * threat: someone holding the Supabase secret key can read every object, but
 * not this key, so they read ciphertext. GCM's tag also means a modified
 * object fails to decrypt rather than showing the reviewer a swapped photo.
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptImage(secret: string, plain: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "image"), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptImage(secret: string, sealed: Buffer): Buffer {
  const iv = sealed.subarray(0, IV_BYTES);
  const tag = sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = sealed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, "image"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}
