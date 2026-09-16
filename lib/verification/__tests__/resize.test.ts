import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/verification/resize";

describe("fitWithin", () => {
  it("scales a landscape phone frame to 1000 on the long edge", () => {
    expect(fitWithin(4032, 3024, 1000)).toEqual({ width: 1000, height: 750 });
  });

  it("scales a portrait frame by its height", () => {
    expect(fitWithin(1080, 1920, 1000)).toEqual({ width: 563, height: 1000 });
  });

  it("never enlarges", () => {
    expect(fitWithin(640, 480, 1000)).toEqual({ width: 640, height: 480 });
  });
});
