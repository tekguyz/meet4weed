import { describe, expect, it } from "vitest";
import { FLORIDA, inFlorida, mapStart } from "@/lib/sesh/map-centre";

const MIAMI = { lat: 25.76, lng: -80.19 };
const TAMPA = { lat: 27.95, lng: -82.46 };
const NULL_ISLAND = { lat: 0, lng: 0 };

describe("inFlorida", () => {
  it.each([
    ["Miami", MIAMI],
    ["Tampa", TAMPA],
    ["Pensacola", { lat: 30.42, lng: -87.22 }],
    ["Key West", { lat: 24.56, lng: -81.78 }],
  ])("keeps %s", (_name, point) => {
    expect(inFlorida(point)).toBe(true);
  });

  it.each([
    ["0, 0 in the Atlantic", NULL_ISLAND],
    ["Atlanta", { lat: 33.75, lng: -84.39 }],
    ["Havana", { lat: 23.11, lng: -82.37 }],
    ["lat and lng swapped", { lat: -80.19, lng: 25.76 }],
  ])("drops %s", (_name, point) => {
    expect(inFlorida(point)).toBe(false);
  });
});

describe("mapStart", () => {
  it("centres on the mean of the circles", () => {
    const start = mapStart([MIAMI, TAMPA]);

    expect(start.centre.lat).toBeCloseTo((MIAMI.lat + TAMPA.lat) / 2);
    expect(start.centre.lng).toBeCloseTo((MIAMI.lng + TAMPA.lng) / 2);
    expect(start.zoom).toBe(11);
  });

  // The bug this exists for: one sesh saved at 0, 0 pulled the mean out to
  // 14.4, -41.9, and the whole feed map showed open sea.
  it("ignores a circle outside Florida, so one bad sesh cannot move the map out to sea", () => {
    expect(mapStart([TAMPA, NULL_ISLAND])).toEqual({ centre: TAMPA, zoom: 11 });
  });

  it("falls back to all of Florida when nothing is in Florida", () => {
    expect(mapStart([NULL_ISLAND])).toEqual({ centre: FLORIDA, zoom: 6 });
  });

  it("falls back to all of Florida when there is nothing at all", () => {
    expect(mapStart([])).toEqual({ centre: FLORIDA, zoom: 6 });
  });
});
