import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedControls } from "@/components/sesh/feed-controls";
import { parseFeedFilters, type FeedFilters } from "@/lib/sesh/feed-filters";

/** The feed's whole state is in the URL, so the controls are links and a GET
 *  form — not a router dance. That means a test can read an href and know
 *  exactly what tapping it does, and the feed still works with no JavaScript. */
function filters(overrides: Partial<FeedFilters> = {}): FeedFilters {
  return { types: [], search: "", view: "list", page: 1, ...overrides };
}

function hrefOf(name: RegExp | string): FeedFilters {
  const link = screen.getByRole("link", { name });
  const url = new URL(link.getAttribute("href")!, "http://x");
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }
  return parseFeedFilters(params);
}

describe("FeedControls", () => {
  it("offers a chip for every kind of sesh", () => {
    render(<FeedControls filters={filters()} />);

    expect(screen.getByRole("link", { name: "Chill" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Smoke circle" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
  });

  it("turns a chip on when it is off", () => {
    render(<FeedControls filters={filters()} />);

    expect(hrefOf("Chill").types).toEqual(["chill"]);
  });

  it("turns a chip off when it is already on, without losing the others", () => {
    render(<FeedControls filters={filters({ types: ["chill", "outdoors"] })} />);

    expect(hrefOf("Chill").types).toEqual(["outdoors"]);
  });

  it("says which chips are on, for a screen reader as well as a sighted member", () => {
    render(<FeedControls filters={filters({ types: ["chill"] })} />);

    expect(screen.getByRole("link", { name: "Chill" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Outdoors" })).not.toHaveAttribute("aria-current");
  });

  it("sends a member back to the first page when they change a chip", () => {
    render(<FeedControls filters={filters({ page: 4 })} />);

    expect(hrefOf("Chill").page).toBe(1);
  });

  it("keeps the search text when a chip changes", () => {
    render(<FeedControls filters={filters({ search: "blanket" })} />);

    expect(hrefOf("Chill").search).toBe("blanket");
  });

  it("switches to the map and keeps the filters", () => {
    render(<FeedControls filters={filters({ types: ["chill"], search: "blanket" })} />);

    expect(hrefOf(/map/i)).toMatchObject({ view: "map", types: ["chill"], search: "blanket" });
  });

  it("switches back to the list", () => {
    render(<FeedControls filters={filters({ view: "map" })} />);

    expect(hrefOf(/list/i).view).toBe("list");
  });

  it("searches with a plain form, so it works without JavaScript", () => {
    render(<FeedControls filters={filters()} />);

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/seshes");
    expect(screen.getByRole("searchbox", { name: /search/i })).toHaveAttribute("name", "q");
  });

  it("carries the chips and the view through a search, so searching does not reset them", () => {
    render(<FeedControls filters={filters({ types: ["chill", "outdoors"], view: "map" })} />);

    const form = screen.getByRole("search");
    const hidden = [...form.querySelectorAll("input[type=hidden]")].map((i) => [
      i.getAttribute("name"),
      i.getAttribute("value"),
    ]);
    expect(hidden).toEqual([
      ["type", "chill"],
      ["type", "outdoors"],
      ["view", "map"],
    ]);
  });

  it("shows the search text the member already typed", () => {
    render(<FeedControls filters={filters({ search: "blanket" })} />);

    expect(screen.getByRole("searchbox", { name: /search/i })).toHaveValue("blanket");
  });
});
