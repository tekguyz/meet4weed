import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The copy script and the component agree on one path by convention only:
 *  nothing imports the copied file, so a rename in either place would compile,
 *  pass every other test, deploy, and leave a map that draws no tiles. This
 *  ties the two ends together.
 *
 *  The file itself is not asserted to exist. It is git-ignored and written by
 *  `prebuild`, which CI runs after the tests. */
const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const PUBLIC_DIR = "public/maplibre";
const FILENAME = "maplibre-gl-worker.js";

describe("the MapLibre worker copy", () => {
  it("writes the file the map asks for", () => {
    const script = read("scripts/copy-maplibre-worker.mjs");
    expect(script).toContain(`"${PUBLIC_DIR}"`);
    expect(script).toContain(`"${FILENAME}"`);
  });

  it("is the path the map loads", () => {
    expect(read("components/sesh/sesh-map.tsx")).toContain(`setWorkerUrl("/${PUBLIC_DIR.replace("public/", "")}/${FILENAME}")`);
  });

  it("is not swallowed by the proxy, which would return HTML instead", () => {
    expect(read("proxy.ts")).toContain("maplibre/");
  });

  it("is git-ignored, because it is a copy of something in node_modules", () => {
    expect(read(".gitignore")).toContain(`${PUBLIC_DIR}/`);
  });
});
