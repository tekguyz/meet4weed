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
    // Real timers: the loop is a plain interval, and faking time around the
    // camera's own promises made this race.
    const check = vi.fn(async () => ["glare" as const]);
    render(<CameraCapture facing="environment" guide="card" check={check} onCapture={() => {}} />);

    expect(await screen.findByText(LIVE_HINT_TEXT.glare, {}, { timeout: LIVE_CHECK.intervalMs * 10 })).toBeInTheDocument();
    expect(check).toHaveBeenCalled();
  });

  it("stops checking while it is not active", async () => {
    const check = vi.fn(async () => []);
    render(<CameraCapture facing="environment" guide="card" check={check} active={false} onCapture={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());

    await new Promise((resolve) => setTimeout(resolve, LIVE_CHECK.intervalMs * 3));
    expect(check).not.toHaveBeenCalled();
  });

  /** A laptop with no camera: the browser says NotFoundError. That is not a
   *  permission problem, so the member is sent to their phone instead. */
  it("sends a member with no camera to their phone, with the link", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException("none", "NotFoundError"))) },
    });
    render(<CameraCapture facing="environment" guide="card" onCapture={() => {}} />);

    expect(await screen.findByText(/open this page on your phone/i)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/verify`)).toBeInTheDocument();
    expect(screen.queryByText(/allow camera access/i)).not.toBeInTheDocument();
  });

  it("still asks for permission when the camera was refused", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException("no", "NotAllowedError"))) },
    });
    render(<CameraCapture facing="environment" guide="card" onCapture={() => {}} />);

    expect(await screen.findByText(/allow camera access/i)).toBeInTheDocument();
  });
});
