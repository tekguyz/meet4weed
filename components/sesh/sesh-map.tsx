"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { inFlorida, mapStart, type Point } from "@/lib/sesh/map-centre";

export type { Point };

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
  /** The circle lit from the feed list on a laptop (#125). */
  lit?: string | null;
  /** Clicking a circle calls this with its sesh id. Read when the map is
   *  built: a map built without it has no circle taps at all, which is how
   *  the phone map keeps no new tap actions. */
  onCircleClick?: (id: string) => void;
  /** Size classes. Defaults to h-64. */
  className?: string;
};

/** Both lit layers draw only the circle whose id matches. */
const LIT_LAYERS = ["circle-lit-fill", "circle-lit-line"] as const;
const litFilter = (id: string | null | undefined) => ["==", ["get", "id"], id ?? ""];

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


type MapLike = {
  on(event: string, handler: (event: never) => void): unknown;
  on(event: string, layer: string, handler: (event: never) => void): unknown;
  addSource(id: string, source: unknown): unknown;
  addLayer(layer: unknown): unknown;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  setFilter(layer: string, filter: unknown): unknown;
  getCanvas(): { style: { cursor: string } };
  getBounds(): { contains(at: [number, number]): boolean };
  easeTo(options: { center: [number, number]; duration?: number }): unknown;
  setCenter(centre: [number, number]): unknown;
  remove(): void;
};

type MarkerLike = { setLngLat(at: [number, number]): MarkerLike; addTo(map: MapLike): MarkerLike; remove(): void };

export function SeshMap({ circles, marker, onPick, centre, label, lit = null, onCircleClick, className = "h-64" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLike | null>(null);
  const loaded = useRef(false);
  const pin = useRef<MarkerLike | null>(null);
  const makePin = useRef<(() => MarkerLike) | null>(null);

  // Kept in a ref so the map is built once. Rebuilding it on every render
  // would throw away the member's zoom and pan.
  const pick = useRef(onPick);
  pick.current = onPick;
  const circleClick = useRef(onCircleClick);
  circleClick.current = onCircleClick;
  const litNow = useRef(lit);
  litNow.current = lit;

  useEffect(() => {
    let cancelled = false;
    const start = mapStart(circles);

    // Dynamic, so the library is fetched only on screens that show a map.
    // v6 exports its classes by name; there is no default export.
    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !container.current) return;

      const accent = token("--map-accent");
      const litColour = token("--map-lit");

      // MapLibre otherwise builds this address from `import.meta.url` and the
      // production build emits no chunk there, so the request fell through to
      // the app shell and the browser refused an HTML file as a module script.
      // The worker parses tiles, so the map drew its background and nothing
      // else. scripts/copy-maplibre-worker.mjs puts the file at this path.
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.js");

      const instance = new maplibre.Map({
        container: container.current,
        style: token("--map-style"),
        center: [start.centre.lng, start.centre.lat],
        zoom: start.zoom,
        // The full credit line, not the compact "i" button: that button is a
        // ~24px tap target, under the 44px floor (spec §7.1).
        attributionControl: { compact: false },
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
        instance.addLayer({
          id: "circle-lit-fill",
          type: "fill",
          source: "circles",
          filter: litFilter(litNow.current),
          paint: { "fill-color": litColour, "fill-opacity": 0.4 },
        });
        instance.addLayer({
          id: "circle-lit-line",
          type: "line",
          source: "circles",
          filter: litFilter(litNow.current),
          paint: { "line-color": litColour, "line-width": 3 },
        });
        loaded.current = true;
      });

      if (circleClick.current) {
        instance.on("click", "circle-fill", (event: never) => {
          const id = (event as { features?: { properties?: { id?: string } }[] }).features?.[0]?.properties?.id;
          if (id) circleClick.current?.(id);
        });
        // A circle that does something looks like it.
        instance.on("mouseenter", "circle-fill", () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", "circle-fill", () => {
          instance.getCanvas().style.cursor = "";
        });
      }

      if (pick.current) {
        instance.on("click", (event: never) => {
          const { lat, lng } = (event as { lngLat: Point }).lngLat;
          pick.current?.({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
        });
      }
    });

    return () => {
      cancelled = true;
      loaded.current = false;
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
      // A pin outside Florida is bad data (a sesh once saved at 0, 0). Show
      // it, but keep the map on Florida so the host can drop a real one.
      if (inFlorida(marker)) instance.setCenter([marker.lng, marker.lat]);
    }
  }, [marker]);

  useEffect(() => {
    if (centre) map.current?.setCenter([centre.lng, centre.lat]);
  }, [centre]);

  useEffect(() => {
    // Before load there are no layers to filter; the load handler reads litNow.
    const instance = map.current;
    if (!instance || !loaded.current) return;
    for (const layer of LIT_LAYERS) instance.setFilter(layer, litFilter(lit));

    // A lit circle off the map's edge lights nothing anybody can see, so the
    // map moves to it. One already in view stays put: no needless panning.
    const circle = circles.find((c) => c.id === lit);
    if (circle && !instance.getBounds().contains([circle.lng, circle.lat])) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      instance.easeTo({ center: [circle.lng, circle.lat], duration: reduce ? 0 : 400 });
    }
    // Only a new lit sesh moves the map, never new circles under the same one.
  }, [lit]);

  return (
    <div ref={container} role="application" aria-label={label} className={`w-full rounded-card bg-surface-2 ${className}`} />
  );
}
