// Copies MapLibre's worker from node_modules into public/, for the same reason
// as the MediaPipe runtime: it must be served from this origin.
//
// MapLibre builds its worker URL from `import.meta.url` and starts it with
// `new Worker(url, { type: "module" })`. The Next.js production build does not
// emit a chunk at that address, so the request fell through to the app shell,
// the browser refused an HTML file as a module script, and the worker never
// started. The map then drew its background and nothing else, because tile
// parsing happens in the worker. Pairing this copy with setWorkerUrl() in
// components/sesh/sesh-map.tsx is what fixes it.
//
// TWO files, not one. The worker is a thin entry that imports its bulk from
// `./maplibre-gl-shared.mjs` alongside it. Copying only the entry moved the
// 404 rather than fixing it — same blank map, same silence, one file further
// along. Nothing in the app imports either file, so the build cannot catch it.
//
// Both land as .js, and the import inside the worker is repointed to match. A
// module worker and its imports are rejected unless each response carries a
// JavaScript MIME type, and .js is the extension every host agrees on. Doing
// the rewrite here rather than trusting the host to map .mjs is what keeps
// this from depending on Vercel's content-type table.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const from = path.resolve("node_modules/maplibre-gl/dist");
const to = path.resolve("public/maplibre");
mkdirSync(to, { recursive: true });

// The bulk. Copied verbatim; it imports nothing of its own.
copyFileSync(path.join(from, "maplibre-gl-shared.mjs"), path.join(to, "maplibre-gl-shared.js"));

// The entry, with its one relative import repointed at the copy above.
const worker = readFileSync(path.join(from, "maplibre-gl-worker.mjs"), "utf8");
const repointed = worker.replaceAll("./maplibre-gl-shared.mjs", "./maplibre-gl-shared.js");
if (repointed === worker) {
  throw new Error("maplibre-gl-worker.mjs no longer imports ./maplibre-gl-shared.mjs — check what it imports now.");
}
writeFileSync(path.join(to, "maplibre-gl-worker.js"), repointed);
