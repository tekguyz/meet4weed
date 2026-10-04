import { afterEach, describe, expect, it } from "vitest";
import { seshWhen } from "@/lib/sesh/when";

/** Saturday 3 October 2026, 10:00 in Florida (EDT, UTC−4). */
const SAT_MORNING = new Date("2026-10-03T14:00:00Z");

const at = (iso: string) => seshWhen(new Date(iso), SAT_MORNING);

describe("seshWhen", () => {
  it("calls an evening sesh today Tonight", () => {
    expect(at("2026-10-03T23:30:00Z")).toMatchObject({ soon: "Tonight", label: "Tonight", time: "7:30 PM" });
  });

  /** 20:30 in Florida is already the 4th in UTC. Florida's day decides. */
  it("keeps a late sesh on Florida's day, not UTC's", () => {
    expect(at("2026-10-04T00:30:00Z")).toMatchObject({ soon: "Tonight", day: "3", time: "8:30 PM" });
  });

  /** A morning hike labelled Tonight reads as a mistake. */
  it("calls a daytime sesh today Today", () => {
    expect(at("2026-10-03T15:00:00Z")).toMatchObject({ soon: "Today", time: "11:00 AM" });
    expect(at("2026-10-03T20:59:00Z").soon).toBe("Today");
    expect(at("2026-10-03T21:00:00Z").soon).toBe("Tonight");
  });

  it("calls a sesh on the next Florida day Tomorrow", () => {
    expect(at("2026-10-04T18:00:00Z")).toMatchObject({ soon: "Tomorrow", label: "Tomorrow" });
  });

  /** 23:30 on the 3rd, and the sesh is at 00:30 on the 4th: one hour away,
   *  but on another day. */
  it("turns over at Florida midnight", () => {
    const lateNight = new Date("2026-10-04T03:30:00Z");
    expect(seshWhen(new Date("2026-10-04T04:30:00Z"), lateNight)).toMatchObject({ soon: "Tomorrow", day: "4" });
    expect(seshWhen(new Date("2026-10-04T03:45:00Z"), lateNight)).toMatchObject({ soon: "Tonight", day: "3" });
  });

  it("counts Tomorrow across the end of daylight saving", () => {
    // 22:00 EDT on Sat 31 Oct; the sesh is 20:00 EST on Sun 1 Nov.
    expect(seshWhen(new Date("2026-11-02T01:00:00Z"), new Date("2026-11-01T02:00:00Z"))).toMatchObject({
      soon: "Tomorrow",
      day: "1",
      time: "8:00 PM",
    });
  });

  it("counts Tomorrow across the new year", () => {
    expect(seshWhen(new Date("2027-01-01T23:00:00Z"), new Date("2026-12-31T23:00:00Z"))).toMatchObject({
      soon: "Tomorrow",
      month: "Jan",
      day: "1",
    });
  });

  it("names the weekday for a sesh further out", () => {
    expect(at("2026-10-10T00:00:00Z")).toMatchObject({
      soon: null,
      label: "Fri",
      month: "Oct",
      day: "9",
      time: "8:00 PM",
      sentence: "Friday, October 9 at 8:00 PM",
    });
  });

  it("reads Tonight out with its date", () => {
    expect(at("2026-10-03T23:30:00Z").sentence).toBe("Tonight, Saturday, October 3 at 7:30 PM");
  });

  it("gives the instant for a time element", () => {
    expect(at("2026-10-03T23:30:00Z").iso).toBe("2026-10-03T23:30:00.000Z");
  });

  describe("on a device in another time zone", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    it("still answers in Florida time", () => {
      process.env.TZ = "Asia/Tokyo";
      expect(at("2026-10-04T00:30:00Z")).toMatchObject({ soon: "Tonight", day: "3", time: "8:30 PM" });
    });
  });
});
