import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/** Nothing in the app imports the copied worker, so no build step and no type
 *  can tell you it is wrong. The first version of this copy took the worker
 *  and left behind the file the worker itself imports; the map stayed blank
 *  and the only evidence was a 404 in a browser nobody was watching.
 *
 *  So the script is run for real here and its output is walked. The rule that
 *  matters is the last test: every relative import inside a copied file must
 *  resolve to another copied file. */
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "public/maplibre");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const ENTRY = "maplibre-gl-worker.js";

/** `from"./x.js"` — the shape the bundler emits, unspaced and minified. */
function relativeImportsIn(file: string): string[] {
  const source = readFileSync(path.join(out, file), "utf8");
  return [...source.matchAll(/(?:from|import)"(\.\/[^"]+)"/g)].map((match) => match[1]);
}

describe("the MapLibre worker copy", () => {
  beforeAll(() => {
    rmSync(out, { recursive: true, force: true });
    execFileSync("node", ["scripts/copy-maplibre-worker.mjs"], { cwd: root });
  });

  it("writes the entry the map asks for", () => {
    expect(existsSync(path.join(out, ENTRY))).toBe(true);
  });

  it("is the path the map loads", () => {
    expect(read("components/sesh/sesh-map.tsx")).toContain(`setWorkerUrl("/maplibre/${ENTRY}")`);
  });

  it("serves every file as .js, because a module worker needs a JavaScript MIME type", () => {
    for (const specifier of relativeImportsIn(ENTRY)) {
      expect(specifier.endsWith(".js")).toBe(true);
    }
  });

  it("copies everything the worker imports, not just the worker", () => {
    const seen = new Set<string>();
    const queue = [ENTRY];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const specifier of relativeImportsIn(file)) {
        const next = path.basename(specifier);
        expect(existsSync(path.join(out, next)), `${file} imports ${specifier}, which was not copied`).toBe(true);
        queue.push(next);
      }
    }
    // The worker is a thin entry over one shared bundle. If this number moves,
    // MapLibre has been split differently and the copy needs a fresh look.
    expect(seen.size).toBe(2);
  });

  it("is not swallowed by the proxy, which would return HTML instead", () => {
    expect(read("proxy.ts")).toContain("maplibre/");
  });

  it("is git-ignored, because it is a copy of something in node_modules", () => {
    expect(read(".gitignore")).toContain("public/maplibre/");
  });
});
