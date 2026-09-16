/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { decryptImage, encryptImage } from "@/lib/verification/image-crypto";

const SECRET = Buffer.alloc(32, 1).toString("base64");
const OTHER = Buffer.alloc(32, 2).toString("base64");
const PLAIN = Buffer.from("synthetic image bytes, not a real card");

describe("image encryption", () => {
  it("round-trips", () => {
    expect(decryptImage(SECRET, encryptImage(SECRET, PLAIN)).equals(PLAIN)).toBe(true);
  });

  it("stores no plaintext and never repeats itself", () => {
    const a = encryptImage(SECRET, PLAIN);
    const b = encryptImage(SECRET, PLAIN);
    expect(a.includes(PLAIN)).toBe(false);
    expect(a.equals(b)).toBe(false);
  });

  it("refuses a tampered object", () => {
    const sealed = encryptImage(SECRET, PLAIN);
    sealed[sealed.length - 1] ^= 1;
    expect(() => decryptImage(SECRET, sealed)).toThrow();
  });

  it("refuses the wrong key", () => {
    expect(() => decryptImage(OTHER, encryptImage(SECRET, PLAIN))).toThrow();
  });

  it("refuses a secret shorter than 32 bytes", () => {
    expect(() => encryptImage(Buffer.alloc(16).toString("base64"), PLAIN)).toThrow(/32 bytes/);
  });
});
