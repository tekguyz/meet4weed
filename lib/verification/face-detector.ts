import type { FaceDetector } from "@mediapipe/tasks-vision";

/** Loaded on the face step only: the runtime is a ~2.4 MB download (measured
 *  2026-09-16). Browser-only. */
const WASM = "/mediapipe/wasm";
const MODEL = "/mediapipe/blaze_face_short_range.tflite";

let loading: Promise<FaceDetector> | null = null;

export function loadFaceDetector(): Promise<FaceDetector> {
  if (!loading) {
    loading = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

export async function countFaces(canvas: HTMLCanvasElement): Promise<number | null> {
  try {
    const detector = await loadFaceDetector();
    return detector.detect(canvas).detections.length;
  } catch (error) {
    console.error(`[face-detector] unavailable: ${(error as Error).name}`);
    return null;
  }
}
