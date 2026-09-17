/** MediaPipe's WASM runtime writes "INFO: Created TensorFlow Lite XNNPACK
 *  delegate for CPU." to stderr, which Emscripten sends to console.error. The
 *  Next.js dev overlay then shows it as a red error, though detection worked
 *  (phone-test finding 6). The runtime binds console.error when its script
 *  loads, so this filter goes in before the load and stays. It drops that one
 *  line and passes everything else through. */
const NOISE = /^INFO: Created TensorFlow Lite XNNPACK delegate/;
const FILTER = Symbol.for("m4w.mediapipeNoiseFilter");

type Marked = typeof console.error & { [FILTER]?: true };

export function quietMediapipeInfo(): void {
  if ((console.error as Marked)[FILTER]) return;
  const next = console.error;
  const filtered: Marked = (...args: unknown[]) => {
    if (typeof args[0] === "string" && NOISE.test(args[0])) return;
    next(...args);
  };
  filtered[FILTER] = true;
  console.error = filtered;
}
