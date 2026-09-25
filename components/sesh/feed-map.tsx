"use client";

import { useState } from "react";
import { SeshMap, type Circle, type Point } from "@/components/sesh/sesh-map";
import { Banner } from "@/components/ui/banner";
import { FOCUS_RING } from "@/components/ui/focus";

type Props = { circles: Circle[] };

/** The map view, plus the only thing on it that can ask where a member is.
 *
 *  Nothing here runs on load. An app built around not leaking location does
 *  not open by asking for the member's — the map centres on whatever the
 *  filtered results cover, and works fully without ever being told. */
export function FeedMap({ circles }: Props) {
  const [centre, setCentre] = useState<Point | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function findMe() {
    if (!navigator.geolocation) {
      setProblem("This browser will not share a location.");
      return;
    }
    setAsking(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAsking(false);
        setCentre({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setAsking(false);
        setProblem("No location this time. The map still works — pan it yourself.");
      },
      { timeout: 8_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SeshMap circles={circles} centre={centre} label="Seshes near you, as circles" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={findMe}
          disabled={asking}
          className={`min-h-11 shrink-0 rounded-control bg-surface-2 px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50 ${FOCUS_RING}`}
        >
          {asking ? "Asking…" : "Near me"}
        </button>
        <p className="text-sm text-ink-muted">
          Each circle is about half a mile across. Nobody&apos;s address is on this map.
        </p>
      </div>

      {problem ? (
        <Banner tone="warning">{problem}</Banner>
      ) : null}
    </div>
  );
}
