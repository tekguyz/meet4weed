/** @vitest-environment node
 *
 *  Cost control 1 (spec §4.4): the Anthropic key — and every other server
 *  secret — never reaches the browser. `server-only` makes a client import of a
 *  server module fail the build; this test makes the rule visible in `npm test`
 *  as well, and catches a raw process.env read that `server-only` cannot see.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

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
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const read = (f: string) => readFileSync(f, "utf8");
const isClient = (src: string) => /^\s*["']use client["']/m.test(src);

const SERVER_SECRETS =
  /\b(SUPABASE_SECRET_KEY|ANTHROPIC_API_KEY|UPSTASH_REDIS_REST_TOKEN|RESEND_API_KEY|VERIFICATION_SECRET|CRON_SECRET)\b/;
const SERVER_MODULES =
  /^import (?!type )[^;]*from ["']@\/lib\/(server-env|derived-keys|supabase\/admin|verification\/(image-crypto|challenge-token|limits|vision|store|submit|owner-alert|reaper)|member\/expiry-sweep|sesh\/invite-token|email)["']/m;

describe("server secrets stay on the server", () => {
  it("no client component reads a non-public environment variable", () => {
    const offenders = files
      .filter((f) => isClient(read(f)))
      .filter((f) => /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b)[A-Z_]+/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no client component imports a server module", () => {
    expect(files.filter((f) => isClient(read(f)) && SERVER_MODULES.test(read(f))).map(rel)).toEqual([]);
  });

  it("server secrets are read in exactly one file, and it is server-only", () => {
    const readers = files.filter((f) => new RegExp(`process\\.env\\.${SERVER_SECRETS.source}`).test(read(f))).map(rel);
    expect(readers.every((f) => f === "lib/server-env.ts")).toBe(true);
    expect(read(path.join(ROOT, "lib/server-env.ts"))).toMatch(/^import "server-only";/m);
  });

  it("every module that imports the server environment is itself server-only", () => {
    const missing = files
      .filter((f) => /from ["']@\/lib\/server-env["']/.test(read(f)))
      .filter((f) => !/^import "server-only";/m.test(read(f)))
      .map(rel)
      // Anything under app/ without "use client" — pages, layouts, route
      // handlers, server actions — is server code by construction.
      .filter((f) => !(f.startsWith("app/") && !isClient(read(path.join(ROOT, f)))));
    expect(missing).toEqual([]);
  });
});
