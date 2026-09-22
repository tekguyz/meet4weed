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
// Copied as .js, not .mjs: a module worker is rejected unless the response
// carries a JavaScript MIME type, and .js is the extension every host agrees on.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const from = path.resolve("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = path.resolve("public/maplibre");
mkdirSync(to, { recursive: true });
copyFileSync(from, path.join(to, "maplibre-gl-worker.js"));
