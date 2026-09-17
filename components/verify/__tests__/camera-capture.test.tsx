import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/verification/resize", () => ({
  drawScaled: () => document.createElement("canvas"),
  fitWithin: (w: number, h: number) => ({ width: w, height: h }),
}));

import { CameraCapture, viewfinderWidth } from "@/components/verify/camera-capture";
import { LIVE_CHECK } from "@/lib/verification/live-hint";
import { LIVE_HINT_TEXT } from "@/lib/verification/messages";

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

  it("counts down 3 seconds on screen before a timed photo", async () => {
    const onCapture = vi.fn();
    render(<CameraCapture facing="user" guide="face" timerSeconds={3} onCapture={onCapture} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo in 3 seconds" })).toBeEnabled());
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Tap to take the photo" }));
    expect(screen.getByRole("status")).toHaveTextContent("3");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toHaveTextContent("2");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Tap to take the photo" }));
    expect(onCapture).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onCapture).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a live hint from the pre-checks over the viewfinder", async () => {
    // Fake timers before render: the interval starts as soon as the camera is live.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const check = vi.fn(async () => ["glare" as const]);
    render(<CameraCapture facing="environment" guide="card" check={check} onCapture={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());

    await act(async () => vi.advanceTimersByTime(LIVE_CHECK.intervalMs));
    expect(check).toHaveBeenCalled();
    expect(screen.getByText(LIVE_HINT_TEXT.glare)).toBeInTheDocument();
  });

  it("stops checking while it is not active", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const check = vi.fn(async () => []);
    render(<CameraCapture facing="environment" guide="card" check={check} active={false} onCapture={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());

    await act(async () => vi.advanceTimersByTime(LIVE_CHECK.intervalMs * 3));
    expect(check).not.toHaveBeenCalled();
  });
});
