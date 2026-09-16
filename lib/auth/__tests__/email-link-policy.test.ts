/** @vitest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_LINK_EXPIRY_MINUTES, EMAIL_LINK_EXPIRY_SECONDS } from "@/lib/auth/email-link-policy";

/** The screens state the link's lifetime, so the config that decides it must
 *  agree. This covers supabase/config.toml and the two templates; the HOSTED
 *  values are set in the dashboard and mirrored there (spec §4.5). */

const ROOT = path.resolve(import.meta.dirname, "../../..");
// CRLF on Windows checkouts (core.autocrlf), LF everywhere else.
const toml = readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8").replace(/\r\n/g, "\n");

/** The body of one [section], up to the next header. A tiny reader, not a TOML
 *  parser: enough for flat `key = value` lines, which is all this checks. */
function section(name: string): Record<string, string> {
  const start = toml.indexOf(`\n[${name}]\n`);
  expect(start, `[${name}] missing from config.toml`).toBeGreaterThan(-1);
  const body = toml.slice(start + name.length + 4).split(/\n\[/)[0];
  return Object.fromEntries(
    body
      .split("\n")
      .filter((l) => /^\w+\s*=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

describe("email link policy — config.toml agrees with lib/auth/email-link-policy.ts", () => {
  it("is one hour", () => {
    expect(EMAIL_LINK_EXPIRY_SECONDS).toBe(3600);
  });

  it("gates sign-in on a confirmed email", () => {
    expect(section("auth.email").enable_confirmations).toBe("true");
  });

  it("sets the lifetime the screens state", () => {
    expect(Number(section("auth.email").otp_expiry)).toBe(EMAIL_LINK_EXPIRY_SECONDS);
  });

  for (const [template, type] of [
    ["confirmation", "email"],
    ["recovery", "recovery"],
  ]) {
    it(`builds the ${template} link from the token hash, landing on /auth/confirm`, () => {
      const entry = section(`auth.email.template.${template}`);
      const html = readFileSync(path.join(ROOT, JSON.parse(entry.content_path) as string), "utf8");
      expect(html).toContain(`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=${type}`);
      // ConfirmationURL goes through Supabase's own GET verify: a mail scanner
      // spends it, and it needs a PKCE cookie from the browser that asked.
      expect(html).not.toContain("ConfirmationURL");
      expect(html).toContain(`${EMAIL_LINK_EXPIRY_MINUTES} minutes`);
    });
  }
});
