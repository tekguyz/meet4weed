"use client";

import { useState } from "react";
import { SeshMap, type Point } from "@/components/sesh/sesh-map";

/** The radius the trigger writes. Shown here so the host sees exactly what
 *  the app is about to publish — they cannot reshuffle it, because it is a
 *  fixed function of their address. */
const PUBLISHED_RADIUS_M = 400;

type Props = {
  defaultPoint?: Point | null;
  fieldError?: string;
};

export function LocationPicker({ defaultPoint = null, fieldError }: Props) {
  const [point, setPoint] = useState<Point | null>(defaultPoint);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">
        Drop a pin on your front door. Nobody sees this point until you approve them.
      </p>

      <SeshMap
        circles={point ? [{ id: "preview", ...point, radiusM: PUBLISHED_RADIUS_M }] : []}
        marker={point}
        onPick={setPoint}
        label="Tap the map to drop a pin where the sesh is"
      />

      {/* The form's real values. The action reads these, not the map. */}
      <input type="hidden" name="exactLat" value={point?.lat ?? ""} readOnly />
      <input type="hidden" name="exactLng" value={point?.lng ?? ""} readOnly />

      {point ? (
        <p role="status" className="text-sm text-ink-muted">
          The shaded circle is what the feed and the map show — about half a mile across, and never
          centred on your door. It is the same circle every time you host here.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">Tap the map to place your pin.</p>
      )}

      {fieldError ? (
        <p role="alert" className="text-sm text-danger">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}
