import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateBlock, SeatMeter, WhenLine } from "@/components/sesh/card-parts";
import { SeshTypeArt } from "@/components/sesh/sesh-type-art";
import { SESH_TYPES, SESH_TYPE_LABELS } from "@/lib/sesh/schema";
import { seshWhen } from "@/lib/sesh/when";

/** Each part shows a picture and reads one plain sentence. These check what a
 *  screen reader hears, not how the picture is drawn. */

describe("SeshTypeArt", () => {
  it.each(SESH_TYPES)("is an image named by its type: %s", (type) => {
    render(<SeshTypeArt type={type} />);
    expect(screen.getByRole("img", { name: SESH_TYPE_LABELS[type] })).toBeInTheDocument();
  });
});

describe("SeatMeter", () => {
  it("reads the seats out, not the dots", () => {
    render(<SeatMeter capacity={6} approved={3} />);
    expect(screen.getByText("3 of 6 seats taken")).toBeInTheDocument();
  });

  /** The dots alone did not say "people going" to anyone new to the app. */
  it("writes the count beside the dots", () => {
    render(<SeatMeter capacity={6} approved={3} />);
    expect(screen.getByText("3 of 6 going")).toBeInTheDocument();
  });

  it("says Full when the room is full", () => {
    render(<SeatMeter capacity={6} approved={6} />);
    expect(screen.getByText("6 of 6 seats taken. Full.")).toBeInTheDocument();
  });

  it("writes the count beside a big sesh's bar", () => {
    render(<SeatMeter capacity={40} approved={18} />);
    expect(screen.getByText("18 of 40 going")).toBeInTheDocument();
  });
});

describe("WhenLine and DateBlock", () => {
  const when = seshWhen(new Date("2026-10-03T23:30:00Z"), new Date("2026-10-03T14:00:00Z"));

  it("reads the date out as one sentence, as a time", () => {
    render(<WhenLine when={when} />);
    const sentence = screen.getByText("Tonight, Saturday, October 3 at 7:30 PM");
    expect(sentence.closest("time")).toHaveAttribute("dateTime", "2026-10-03T23:30:00.000Z");
  });

  /** The tile repeats the line beside it; read twice, it is noise. */
  it("hides the tile from a screen reader", () => {
    const { container } = render(<DateBlock when={when} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
