"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export type Point = { lat: number; lng: number };

/** One published circle. Never an exact point — the feed and the map only
 *  ever receive fuzzy coordinates. */
export type Circle = Point & { id: string; radiusM: number };

type Props = {
  circles: Circle[];
  /** A pin, for the picker. The feed never shows one. */
  marker?: Point | null;
  /** Omit to make the map read-only. */
  onPick?: (point: Point) => void;
  /** Recentre on demand — what "near me" moves. */
  centre?: Point | null;
  label: string;
};

/** Roughly Florida, for when there is nothing to centre on. Never the
 *  member's own position: this map does not ask the browser where anybody is
 *  unless they press the button that says so. */
const FLORIDA: Point = { lat: 28.1, lng: -82.4 };

/** Every colour and style URL still lives in app/globals.css. A MapLibre
 *  style is its own JSON document that the library fetches, and its paint
 *  properties take colour values rather than classes, so the component reads
 *  the tokens instead of holding them. */
function token(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

/** A circle in metres, as GeoJSON. MapLibre's circle layer sizes in pixels,
 *  which would shrink as you zoom out and stop meaning 400 m. */
function ring(centre: Point, radiusM: number, steps = 64) {
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / 111_320;
    const dLng = (radiusM * Math.sin(angle)) / (111_320 * Math.cos((centre.lat * Math.PI) / 180));
    coordinates.push([centre.lng + dLng, centre.lat + dLat]);
  }
  return coordinates;
}

function toGeoJson(circles: Circle[]) {
  return {
    type: "FeatureCollection" as const,
    features: circles.map((circle) => ({
      type: "Feature" as const,
      id: circle.id,
      geometry: { type: "Polygon" as const, coordinates: [ring(circle, circle.radiusM)] },
      properties: { id: circle.id },
    })),
  };
}

function meanOf(circles: Circle[]): Point | null {
  if (!circles.length) return null;
  const lat = circles.reduce((sum, c) => sum + c.lat, 0) / circles.length;
  const lng = circles.reduce((sum, c) => sum + c.lng, 0) / circles.length;
  return { lat, lng };
}

type MapLike = {
  on(event: string, handler: (event: never) => void): unknown;
  addSource(id: string, source: unknown): unknown;
  addLayer(layer: unknown): unknown;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  setCenter(centre: [number, number]): unknown;
  remove(): void;
};

type MarkerLike = { setLngLat(at: [number, number]): MarkerLike; addTo(map: MapLike): MarkerLike; remove(): void };

export function SeshMap({ circles, marker, onPick, centre, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLike | null>(null);
  const pin = useRef<MarkerLike | null>(null);
  const makePin = useRef<(() => MarkerLike) | null>(null);

  // Kept in a ref so the map is built once. Rebuilding it on every render
  // would throw away the member's zoom and pan.
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let cancelled = false;
    const start = meanOf(circles) ?? FLORIDA;

    // Dynamic, so the library is fetched only on screens that show a map.
    // v6 exports its classes by name; there is no default export.
    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !container.current) return;

      const accent = token("--map-accent");
      const instance = new maplibre.Map({
        container: container.current,
        style: token("--map-style"),
        center: [start.lng, start.lat],
        zoom: circles.length ? 11 : 6,
      }) as unknown as MapLike;
      map.current = instance;
      makePin.current = () => new maplibre.Marker({ color: accent }) as unknown as MarkerLike;

      instance.on("load", () => {
        instance.addSource("circles", { type: "geojson", data: toGeoJson(circles) });
        instance.addLayer({
          id: "circle-fill",
          type: "fill",
          source: "circles",
          paint: { "fill-color": accent, "fill-opacity": 0.22 },
        });
        instance.addLayer({
          id: "circle-line",
          type: "line",
          source: "circles",
          paint: { "line-color": accent, "line-width": 2 },
        });
      });

      if (pick.current) {
        instance.on("click", (event: never) => {
          const { lat, lng } = (event as { lngLat: Point }).lngLat;
          pick.current?.({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
        });
      }
    });

    return () => {
      cancelled = true;
      pin.current?.remove();
      pin.current = null;
      map.current?.remove();
      map.current = null;
    };
    // Built once, on purpose. Later data is pushed in by the effects below.
  }, []);

  useEffect(() => {
    map.current?.getSource("circles")?.setData(toGeoJson(circles));
  }, [circles]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    pin.current?.remove();
    pin.current = null;
    if (marker) {
      pin.current = makePin.current?.()?.setLngLat([marker.lng, marker.lat]).addTo(instance) ?? null;
      instance.setCenter([marker.lng, marker.lat]);
    }
  }, [marker]);

  useEffect(() => {
    if (centre) map.current?.setCenter([centre.lng, centre.lat]);
  }, [centre]);

  return (
    <div ref={container} role="application" aria-label={label} className="h-64 w-full rounded-card bg-surface-2" />
  );
}
