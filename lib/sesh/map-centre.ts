/** Where a map opens. Pure, so it is tested without MapLibre. */

export type Point = { lat: number; lng: number };

/** Roughly Florida, for when there is nothing to centre on. Never the
 *  member's own position: the map does not ask the browser where anybody is
 *  unless they press the button that says so. */
export const FLORIDA: Point = { lat: 28.1, lng: -82.4 };

/** A box around the state, the Keys and the Panhandle included. The app is
 *  Florida-only, so anything outside it is bad data, not a place. */
const BOUNDS = { south: 24.3, north: 31.1, west: -87.7, east: -79.8 };

export function inFlorida({ lat, lng }: Point): boolean {
  return lat >= BOUNDS.south && lat <= BOUNDS.north && lng >= BOUNDS.west && lng <= BOUNDS.east;
}

/**
 * The mean of the circles in Florida. A circle outside it is still drawn,
 * but it does not steer the map: one sesh saved at 0, 0 once dragged the
 * mean to 14.4, -41.9, and the whole feed map showed open sea.
 */
export function mapStart(points: Point[]): { centre: Point; zoom: number } {
  const kept = points.filter(inFlorida);
  if (!kept.length) return { centre: FLORIDA, zoom: 6 };
  const lat = kept.reduce((sum, p) => sum + p.lat, 0) / kept.length;
  const lng = kept.reduce((sum, p) => sum + p.lng, 0) / kept.length;
  return { centre: { lat, lng }, zoom: 11 };
}
