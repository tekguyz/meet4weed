"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export type Point = { lat: number; lng: number };

type Props = {
  point: Point | null;
  /** Draw the published circle around `point`, in metres. */
  radiusM?: number;
  /** Omit to make the map read-only. */
  onPick?: (point: Point) => void;
  label: string;
};

/** Roughly Florida, for when there is nothing to centre on. Never the host's
 *  own position: this map does not ask the browser where anybody is. */
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
function circleAround(centre: Point, radiusM: number, steps = 64) {
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / 111_320;
    const dLng = (radiusM * Math.sin(angle)) / (111_320 * Math.cos((centre.lat * Math.PI) / 180));
    coordinates.push([centre.lng + dLng, centre.lat + dLat]);
  }
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
    properties: {},
  };
}

const EMPTY = { type: "FeatureCollection" as const, features: [] };

type MapLike = {
  on(event: string, handler: (event: never) => void): unknown;
  addSource(id: string, source: unknown): unknown;
  addLayer(layer: unknown): unknown;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  setCenter(centre: [number, number]): unknown;
  remove(): void;
};

type MarkerLike = { setLngLat(at: [number, number]): MarkerLike; addTo(map: MapLike): MarkerLike; remove(): void };

export function SeshMap({ point, radiusM, onPick, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLike | null>(null);
  const marker = useRef<MarkerLike | null>(null);
  const makeMarker = useRef<((accent: string) => MarkerLike) | null>(null);

  // Kept in a ref so the map is built once. Rebuilding it on every render
  // would throw away the host's zoom and pan.
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let cancelled = false;

    // Dynamic, so the library is fetched only on screens that show a map.
    // v6 exports its classes by name; there is no default export.
    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !container.current) return;

      const accent = token("--map-accent");
      const instance = new maplibre.Map({
        container: container.current,
        style: token("--map-style"),
        center: [point?.lng ?? FLORIDA.lng, point?.lat ?? FLORIDA.lat],
        zoom: point ? 14 : 6,
      }) as unknown as MapLike;
      map.current = instance;
      makeMarker.current = () => new maplibre.Marker({ color: accent }) as unknown as MarkerLike;

      instance.on("load", () => {
        instance.addSource("circle", { type: "geojson", data: EMPTY });
        instance.addLayer({
          id: "circle-fill",
          type: "fill",
          source: "circle",
          paint: { "fill-color": accent, "fill-opacity": 0.22 },
        });
        instance.addLayer({
          id: "circle-line",
          type: "line",
          source: "circle",
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
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    instance.getSource("circle")?.setData(point && radiusM ? circleAround(point, radiusM) : EMPTY);

    marker.current?.remove();
    marker.current = null;
    if (point) {
      marker.current = makeMarker.current?.("")?.setLngLat([point.lng, point.lat]).addTo(instance) ?? null;
      instance.setCenter([point.lng, point.lat]);
    }
  }, [point, radiusM]);

  return (
    <div ref={container} role="application" aria-label={label} className="h-64 w-full rounded-card bg-surface-2" />
  );
}
