// Copies MediaPipe's wasm runtime from node_modules into public/, so the face
// detector loads from this origin rather than a third-party CDN. The files are
// ~12 MB raw (2.4 MB brotli) and git-ignored; this runs before dev and build.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const from = path.resolve("node_modules/@mediapipe/tasks-vision/wasm");
const to = path.resolve("public/mediapipe/wasm");
mkdirSync(to, { recursive: true });
for (const file of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]) {
  copyFileSync(path.join(from, file), path.join(to, file));
}
