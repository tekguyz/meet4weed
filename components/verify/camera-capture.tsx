"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IMAGE_LIMITS } from "@/lib/verification/jpeg";
import { drawScaled } from "@/lib/verification/resize";

type Props = {
  facing: "environment" | "user";
  guide: "card" | "face";
  onCapture: (canvas: HTMLCanvasElement) => void;
};

/**
 * Live viewfinder with a guide frame. Not a file input: gallery uploads are
 * not accepted (spec §4.1 step 4).
 *
 * The frame is shown with object-contain in a box of the video's own aspect
 * ratio, so the guide drawn over it covers the same pixels cardGuide() checks.
 */
export function CameraCapture({ facing, guide, onCapture }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "live" | "denied" | "unsupported">("starting");
  const [aspect, setAspect] = useState("4 / 3");

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
        setAspect(`${el.videoWidth} / ${el.videoHeight}`);
        setState("live");
      })
      .catch(() => setState("denied"));

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  if (state === "unsupported") {
    return <p role="alert" className="text-sm text-danger">This browser cannot open the camera. Open Meet4Weed in Safari or Chrome.</p>;
  }
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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-card bg-surface" style={{ aspectRatio: aspect }}>
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
      </div>
      <Button type="button" onClick={capture} disabled={state !== "live"}>
        {state === "live" ? "Take photo" : "Opening camera…"}
      </Button>
    </div>
  );
}
