/** @vitest-environment node
 *
 *  Every feedback line goes through the shared Banner (issue #61), so the app
 *  has one pattern a member learns once. A hand-made `role="status"` line is
 *  the first sign of a new feature inventing its own.
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

/** Not feedback. The camera's 3-2-1 countdown is a live number over the
 *  viewfinder, not a message about something the member did. */
const ALLOWED = new Set(["components/ui/banner.tsx", "components/verify/camera-capture.tsx"]);

describe("feedback lines", () => {
  it("are all the shared Banner", () => {
    const handMade = ["app", "components"]
      .flatMap((d) => walk(path.join(ROOT, d)))
      .filter((f) => !ALLOWED.has(rel(f)))
      .filter((f) => /role=["{]?["']status/.test(readFileSync(f, "utf8")))
      .map(rel);

    expect(handMade).toEqual([]);
  });
});
