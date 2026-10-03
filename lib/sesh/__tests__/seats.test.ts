import { describe, expect, it } from "vitest";
import { DOT_LIMIT, seats } from "@/lib/sesh/seats";

describe("seats", () => {
  it("draws one dot per seat, the taken ones first", () => {
    expect(seats(6, 3)).toMatchObject({ kind: "dots", dots: [true, true, true, false, false, false] });
  });

  /** Dots alone read as decoration to a newcomer; the words say what they are. */
  it("writes the count out beside the dots too", () => {
    expect(seats(6, 3)).toMatchObject({ kind: "dots", count: "3 of 6 going" });
  });

  it("still draws dots at the dot limit", () => {
    expect(DOT_LIMIT).toBe(12);
    const twelve = seats(12, 5);
    expect(twelve.kind).toBe("dots");
    expect(twelve.kind === "dots" && twelve.dots).toHaveLength(12);
  });

  /** Forty dots would flood the card. */
  it("draws a bar, with the count written out, past the dot limit", () => {
    expect(seats(13, 4)).toMatchObject({ kind: "bar", taken: 4, capacity: 13, count: "4 of 13 going" });
    expect(seats(40, 18)).toMatchObject({ kind: "bar", count: "18 of 40 going" });
  });

  it("reads the seats out as one sentence", () => {
    expect(seats(6, 3).sentence).toBe("3 of 6 seats taken");
    expect(seats(40, 18).sentence).toBe("18 of 40 seats taken");
  });

  it("says full when every seat is taken", () => {
    expect(seats(6, 6)).toMatchObject({ full: true, sentence: "6 of 6 seats taken. Full." });
    expect(seats(40, 40)).toMatchObject({ full: true, kind: "bar" });
    expect(seats(6, 5).full).toBe(false);
  });

  it("handles a sesh of one", () => {
    expect(seats(1, 0)).toMatchObject({ kind: "dots", dots: [false], full: false, sentence: "0 of 1 seat taken" });
    expect(seats(1, 1)).toMatchObject({ full: true, sentence: "1 of 1 seat taken. Full." });
  });

  it("handles the biggest sesh the form allows", () => {
    expect(seats(50, 0)).toMatchObject({ kind: "bar", count: "0 of 50 going", full: false });
  });

  /** A host can lower Capacity below the guests already approved. The card
   *  must not draw more taken seats than there are seats. */
  it("never counts more taken seats than there are seats", () => {
    expect(seats(4, 6)).toMatchObject({ dots: [true, true, true, true], full: true, sentence: "4 of 4 seats taken. Full." });
    expect(seats(20, 25)).toMatchObject({ taken: 20, count: "20 of 20 going" });
  });

  it("never counts fewer than none", () => {
    expect(seats(3, -1).sentence).toBe("0 of 3 seats taken");
  });
});
