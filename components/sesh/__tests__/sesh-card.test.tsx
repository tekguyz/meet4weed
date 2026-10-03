import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeshCard } from "@/components/sesh/sesh-card";
import type { FeedSesh } from "@/lib/sesh/queries";

/** What a member sees and hears on a feed card (#125): the Host, the type, the
 *  date, the seats — and the whole card still one link to the sesh. */

const NOW = "2026-10-03T14:00:00.000Z"; // 10:00 AM in Florida

function sesh(overrides: Partial<FeedSesh> = {}): FeedSesh {
  return {
    id: "s1",
    hostId: "host-1",
    title: "Porch hang",
    description: "Bring a chair.",
    seshType: "movie_night",
    startsAt: "2026-10-03T23:30:00.000Z", // 7:30 PM tonight in Florida
    capacity: 6,
    status: "open",
    visibility: "listed",
    areaName: "Seminole Heights",
    approvedCount: 3,
    materiallyChangedAt: null,
    fuzzyLat: 27.99,
    fuzzyLng: -82.46,
    fuzzyRadiusM: 400,
    host: { handle: "porchlight", displayName: "Porch Light", avatarSeed: "abc" },
    ...overrides,
  };
}

describe("SeshCard", () => {
  it("is one link to the sesh, named by its title", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/seshes/s1");
    expect(within(links[0]).getByRole("heading", { name: "Porch hang" })).toBeInTheDocument();
  });

  it("shows the Host's handle", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    expect(screen.getByText("Hosted by @porchlight")).toBeInTheDocument();
  });

  it("says the viewer's own sesh is hosted by them", () => {
    render(<SeshCard sesh={sesh()} viewerId="host-1" now={NOW} />);
    expect(screen.getByText("Hosted by you")).toBeInTheDocument();
    expect(screen.queryByText(/@porchlight/)).not.toBeInTheDocument();
  });

  it("still draws the card when the Host's Profile is hidden from the viewer", () => {
    render(<SeshCard sesh={sesh({ host: null })} viewerId="me" now={NOW} />);
    expect(screen.getByRole("heading", { name: "Porch hang" })).toBeInTheDocument();
    expect(screen.queryByText(/Hosted by/)).not.toBeInTheDocument();
  });

  it("names the type drawing by its sesh type", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    expect(screen.getByRole("img", { name: "Movie night" })).toBeInTheDocument();
  });

  it("reads the date out, Tonight in Florida time", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    expect(screen.getByText("Tonight, Saturday, October 3 at 7:30 PM")).toBeInTheDocument();
  });

  it("reads the seats out for a screen reader", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    expect(screen.getByText("3 of 6 seats taken")).toBeInTheDocument();
  });

  it("keeps the area name and the description", () => {
    render(<SeshCard sesh={sesh()} viewerId="me" now={NOW} />);
    expect(screen.getByText("Seminole Heights")).toBeInTheDocument();
    expect(screen.getByText("Bring a chair.")).toBeInTheDocument();
  });
});
