"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneHandOff } from "@/components/verify/phone-hand-off";
import { IMAGE_LIMITS } from "@/lib/verification/jpeg";
import { LIVE_CHECK, liveHint } from "@/lib/verification/live-hint";
import type { PrecheckProblem } from "@/lib/verification/prechecks";
import { drawScaled } from "@/lib/verification/resize";

type Props = {
  facing: "environment" | "user";
  guide: "card" | "face";
  onCapture: (canvas: HTMLCanvasElement) => void;
  /** A visible self-timer, for the face step where both hands are busy. */
  timerSeconds?: number;
  /** Runs on a small live frame a few times a second, to show a hint. */
  check?: (frame: HTMLCanvasElement) => PrecheckProblem[] | Promise<PrecheckProblem[]>;
  /** False while the viewfinder is hidden behind a preview: no live checks. */
  active?: boolean;
};

/** The viewfinder keeps the video's own aspect ratio but is never taller than
 *  60dvh, so the shutter stays on screen on a tall portrait phone (Pixel 9a
 *  phone test, 2026-09-16). Capping width rather than height keeps the guide
 *  over the same pixels the pre-checks read. */
export function viewfinderWidth(videoWidth: number, videoHeight: number): string {
  return `min(100%, calc(60dvh * ${videoWidth} / ${videoHeight}))`;
}

/**
 * Live viewfinder with a guide frame. Not a file input: gallery uploads are
 * not accepted (spec §4.1 step 4).
 *
 * The frame is shown with object-contain in a box of the video's own aspect
 * ratio, so the guide drawn over it covers the same pixels cardGuide() checks.
 * A tap on the viewfinder takes the photo too.
 */
export function CameraCapture({ facing, guide, onCapture, timerSeconds, check, active = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "live" | "denied" | "no-camera" | "unsupported">("starting");
  const [size, setSize] = useState({ width: 4, height: 3 });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const el = video.current!;
        el.srcObject = s;
        await el.play();
        setSize({ width: el.videoWidth, height: el.videoHeight });
        setState("live");
      })
      // NotFoundError: the browser has no camera to give — a laptop, usually.
      // That is not a permission problem, so it gets the phone hand-off.
      .catch((error: unknown) =>
        setState(error instanceof DOMException && error.name === "NotFoundError" ? "no-camera" : "denied"),
      );

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  useEffect(() => {
    if (!check || !active || state !== "live") return;
    let busy = false;
    let stopped = false;
    const timer = setInterval(async () => {
      const el = video.current;
      if (busy || !el) return;
      busy = true;
      try {
        const problems = await check(drawScaled(el, el.videoWidth, el.videoHeight, LIVE_CHECK.longEdge));
        if (!stopped) setHint(liveHint(problems));
      } catch {
        // A hint is a nicety; the full-size check after the shot still runs.
      } finally {
        busy = false;
      }
    }, LIVE_CHECK.intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [check, active, state]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown > 1) return setCountdown(countdown - 1);
      setCountdown(null);
      capture();
    }, 1000);
    return () => clearTimeout(timer);
    // capture() reads refs and the latest state; re-running on its identity would restart the count.
  }, [countdown]);

  if (state === "unsupported") {
    return <p role="alert" className="text-sm text-danger">This browser cannot open the camera. Open Meet4Weed in Safari or Chrome.</p>;
  }
  if (state === "no-camera") return <PhoneHandOff />;
  if (state === "denied") {
    return (
      <p role="alert" className="text-sm text-danger">
        Meet4Weed needs your camera to check your card. Allow camera access for this site in your browser settings, then
        reload the page.
      </p>
    );
  }

  function capture() {
    const el = video.current;
    if (!el || state !== "live") return;
    onCapture(drawScaled(el, el.videoWidth, el.videoHeight, IMAGE_LIMITS.captureLongEdge));
  }

  function shutter() {
    if (state !== "live" || countdown !== null) return;
    if (timerSeconds) setCountdown(timerSeconds);
    else capture();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label="Tap to take the photo"
        onClick={shutter}
        className="relative block overflow-hidden rounded-card bg-surface"
        style={{ aspectRatio: `${size.width} / ${size.height}`, width: viewfinderWidth(size.width, size.height) }}
      >
        <video ref={video} playsInline muted className="h-full w-full object-contain" />
        {guide === "card" ? (
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-control border-2 border-primary"
            style={{ aspectRatio: "1.586" }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute top-[8%] left-1/2 w-[46%] -translate-x-1/2 rounded-[50%] border-2 border-primary"
            style={{ aspectRatio: "3 / 4" }}
          />
        )}
        {hint ? (
          <span aria-live="polite" className="absolute inset-x-2 bottom-2 rounded-control bg-surface px-3 py-2 text-sm text-ink">
            {hint}
          </span>
        ) : null}
        {countdown !== null ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span role="status" className="flex size-24 items-center justify-center rounded-full bg-primary text-5xl font-semibold text-on-primary">
              {countdown}
            </span>
          </span>
        ) : null}
      </button>
      <Button type="button" className="sticky bottom-4" onClick={shutter} disabled={state !== "live" || countdown !== null}>
        {state !== "live" ? "Opening camera…" : timerSeconds ? `Take photo in ${timerSeconds} seconds` : "Take photo"}
      </Button>
    </div>
  );
}
