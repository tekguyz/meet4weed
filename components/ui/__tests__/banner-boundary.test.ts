/** @vitest-environment node
 *
 *  Every polite feedback line goes through the shared Banner (issue #61), so
 *  the app has one pattern a member learns once. A hand-made `role="status"`
 *  line is the first sign of a new feature inventing its own.
 *
 *  Error lines too (issue #75): a form-wide error is an urgent Banner, and an
 *  error about one field is the shared FieldError under that field.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");

const files = () => ["app", "components"].flatMap((d) => walk(path.join(ROOT, d)));

function handMade(role: string, allowed: Set<string>) {
  const pattern = new RegExp(`role=["{]?["']${role}`);
  return files()
    .filter((f) => !allowed.has(rel(f)))
    .filter((f) => pattern.test(readFileSync(f, "utf8")))
    .map(rel);
}

describe("feedback lines", () => {
  it("are all the shared Banner", () => {
    /** Not feedback. The camera's 3-2-1 countdown is a live number over the
     *  viewfinder, not a message about something the member did. */
    const allowed = new Set(["components/ui/banner.tsx", "components/verify/camera-capture.tsx"]);

    expect(handMade("status", allowed)).toEqual([]);
  });

  it("that are errors are all the shared Banner or FieldError", () => {
    expect(handMade("alert", new Set(["components/ui/banner.tsx"]))).toEqual([]);
  });
});
