/** @vitest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashInviteToken, mintInviteToken, verifyInviteToken } from "@/lib/sesh/invite-token";

const SECRET = Buffer.alloc(32, 7).toString("base64");
const OTHER = Buffer.alloc(32, 8).toString("base64");

/** Flip one character of the given half, so the bytes change but the shape
 *  does not. */
function flip(token: string, half: "random" | "tag"): string {
  const parts = token.split(".");
  const i = half === "random" ? 0 : 1;
  parts[i] = (parts[i][0] === "A" ? "B" : "A") + parts[i].slice(1);
  return parts.join(".");
}

describe("invite tokens", () => {
  it("verifies a minted token", () => {
    expect(verifyInviteToken(SECRET, mintInviteToken(SECRET))).toBe(true);
  });

  it("never mints the same token twice", () => {
    const seen = new Set(Array.from({ length: 200 }, () => mintInviteToken(SECRET)));
    expect(seen.size).toBe(200);
  });

  it("refuses a flipped byte in the random half", () => {
    expect(verifyInviteToken(SECRET, flip(mintInviteToken(SECRET), "random"))).toBe(false);
  });

  it("refuses a flipped byte in the tag", () => {
    expect(verifyInviteToken(SECRET, flip(mintInviteToken(SECRET), "tag"))).toBe(false);
  });

  it("refuses a truncated token", () => {
    const token = mintInviteToken(SECRET);
    expect(verifyInviteToken(SECRET, token.slice(0, -1))).toBe(false);
    expect(verifyInviteToken(SECRET, token.split(".")[0])).toBe(false);
    expect(verifyInviteToken(SECRET, "")).toBe(false);
  });

  it("refuses a missing or extra dot", () => {
    const token = mintInviteToken(SECRET);
    expect(verifyInviteToken(SECRET, token.replace(".", ""))).toBe(false);
    expect(verifyInviteToken(SECRET, `${token}.`)).toBe(false);
    expect(verifyInviteToken(SECRET, `${token}.extra`)).toBe(false);
  });

  it("refuses a token signed with a different key", () => {
    expect(verifyInviteToken(OTHER, mintInviteToken(SECRET))).toBe(false);
  });
});

describe("invite token hashing", () => {
  it("hashes the same token the same way every time", () => {
    const token = mintInviteToken(SECRET);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });

  it("gives different hashes to different tokens", () => {
    expect(hashInviteToken(mintInviteToken(SECRET))).not.toBe(hashInviteToken(mintInviteToken(SECRET)));
  });

  it("does not carry the token inside the hash", () => {
    const token = mintInviteToken(SECRET);
    const hash = hashInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.split(".")[0]);
  });
});

describe("the module stays pure", () => {
  const src = readFileSync(path.resolve(import.meta.dirname, "../invite-token.ts"), "utf8");

  it("starts with server-only", () => {
    expect(src).toMatch(/^import "server-only";/);
  });

  it("reads no environment and imports nothing that does I/O", () => {
    expect(src).not.toMatch(/process\.env/);
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["node:crypto", "@/lib/derived-keys"]);
  });
});
