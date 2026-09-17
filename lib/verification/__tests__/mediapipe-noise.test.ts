import { afterEach, describe, expect, it, vi } from "vitest";
import { quietMediapipeInfo } from "@/lib/verification/mediapipe-noise";

const original = console.error;
afterEach(() => {
  console.error = original;
});

describe("quietMediapipeInfo", () => {
  it("drops only MediaPipe's XNNPACK info line from console.error", () => {
    const seen = vi.fn();
    console.error = seen;
    quietMediapipeInfo();

    console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
    expect(seen).not.toHaveBeenCalled();

    console.error("[face-detector] unavailable: TypeError");
    expect(seen).toHaveBeenCalledWith("[face-detector] unavailable: TypeError");
  });

  it("wraps console.error once, however often the detector loads", () => {
    const seen = vi.fn();
    console.error = seen;
    quietMediapipeInfo();
    const wrapped = console.error;
    quietMediapipeInfo();
    expect(console.error).toBe(wrapped);
  });
});
