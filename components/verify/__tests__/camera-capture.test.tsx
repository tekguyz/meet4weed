import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/verification/resize", () => ({
  drawScaled: () => document.createElement("canvas"),
  fitWithin: (w: number, h: number) => ({ width: w, height: h }),
}));

import { CameraCapture, viewfinderWidth } from "@/components/verify/camera-capture";

beforeEach(() => {
  const track = { stop: vi.fn() };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) },
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 1080 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 1920 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("viewfinderWidth", () => {
  it("caps a portrait frame at 60dvh tall while keeping its aspect ratio", () => {
    expect(viewfinderWidth(1080, 1920)).toBe("min(100%, calc(60dvh * 1080 / 1920))");
  });
});

describe("CameraCapture", () => {
  it("keeps the viewfinder short enough for the shutter to stay in view", async () => {
    render(<CameraCapture facing="environment" guide="card" onCapture={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    // The browser folds the calc(): 60dvh × 1080 / 1920 = 33.75dvh wide, so 60dvh tall.
    expect(screen.getByRole("button", { name: "Tap to take the photo" }).style.width).toBe("min(100%, 33.75dvh)");
  });

  it("takes the photo when the viewfinder is tapped", async () => {
    const onCapture = vi.fn();
    const user = userEvent.setup();
    render(<CameraCapture facing="environment" guide="card" onCapture={onCapture} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Tap to take the photo" }));
    expect(onCapture).toHaveBeenCalledOnce();
  });
});
