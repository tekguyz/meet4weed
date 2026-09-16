/** @vitest-environment node */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Magic-link sign-in was retired 2026-09-16 in favour of email + password,
 *  with emailed LINKS only for confirming an account and resetting a password
 *  (spec §4.5). "No second way in" is only true while nothing can mint or
 *  verify a magic link, so this fails if a call comes back.
 *  Prose mentioning the old names is fine; a CALL is not. */

const ROOT = path.resolve(import.meta.dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = [...["app", "components", "lib"].flatMap((d) => walk(path.join(ROOT, d))), path.join(ROOT, "proxy.ts")];
const matching = (pattern: RegExp) =>
  files
    .filter((f) => pattern.test(readFileSync(f, "utf8")))
    .map((f) => path.relative(ROOT, f).split(path.sep).join("/"));

describe("magic-link sign-in stays retired", () => {
  it("walked the tree, not nothing", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("nothing calls signInWithOtp, exchangeCodeForSession, or asks for a magiclink", () => {
    expect(matching(/\.signInWithOtp\(|\.exchangeCodeForSession\(|["']magiclink["']/)).toEqual([]);
  });

  it("verifyOtp is called in exactly one place — the POST behind /auth/confirm", () => {
    expect(matching(/\.verifyOtp\(/)).toEqual(["app/auth/actions/email-link.ts"]);
  });

  it("the /auth/confirm page itself verifies nothing on GET", () => {
    const page = readFileSync(path.join(ROOT, "app/auth/confirm/page.tsx"), "utf8");
    expect(page).not.toMatch(/verifyOtp|createClient/);
  });

  it("the magic-link callback route is gone", () => {
    expect(existsSync(path.join(ROOT, "app/auth/callback"))).toBe(false);
  });
});
