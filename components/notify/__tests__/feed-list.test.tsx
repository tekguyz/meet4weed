import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedList } from "@/components/notify/feed-list";
import type { FeedItem } from "@/lib/notify/feed";

const SESH = "11111111-1111-4111-8111-111111111111";

function item(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    type: "rsvp_requested",
    seshId: SESH,
    seshTitle: "Porch sesh",
    actorHandle: id,
    payload: {},
    readAt: null,
    createdAt: "2026-09-26T16:00:00Z",
    ...overrides,
  };
}

describe("FeedList", () => {
  it("renders the empty state from no rows, in words", () => {
    render(<FeedList items={[]} />);

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("draws one row per notification, never a rollup, in the order given", () => {
    render(<FeedList items={[item("ana"), item("ben"), item("cy")]} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("@ana asked to join Porch sesh."),
      expect.stringContaining("@ben asked to join Porch sesh."),
      expect.stringContaining("@cy asked to join Porch sesh."),
    ]);
  });

  it("links each row to the thing it is about", () => {
    render(<FeedList items={[item("ana")]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/seshes/${SESH}`);
  });

  it("marks an unread row as new, for eyes and for a screen reader", () => {
    render(<FeedList items={[item("ana"), item("ben", { readAt: "2026-09-26T17:00:00Z" })]} />);

    const [fresh, old] = screen.getAllByRole("link");
    expect(fresh).toHaveAttribute("data-unread");
    expect(fresh).toHaveTextContent("New:");
    expect(old).not.toHaveAttribute("data-unread");
    expect(old).not.toHaveTextContent("New:");
  });

  it("shows the time in Florida", () => {
    render(<FeedList items={[item("ana")]} />);

    expect(screen.getByText("Sep 26, 12:00 PM ET")).toBeInTheDocument();
  });
});
