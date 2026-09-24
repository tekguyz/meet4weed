import { describe, expect, it } from "vitest";
import {
  FEED_PAGE_SIZE,
  feedEmptyState,
  feedHref,
  parseFeedFilters,
  SEARCH_MAX,
} from "@/lib/sesh/feed-filters";

/** The shape Next hands a page: a value is missing, a string, or — when the
 *  same key appears twice — an array. Everything in it came from a URL, so
 *  none of it is trustworthy. */
type Params = Record<string, string | string[] | undefined>;

const parse = (params: Params = {}) => parseFeedFilters(params);

describe("parseFeedFilters", () => {
  it("shows every type, as a list, from the first page when nothing is asked for", () => {
    expect(parse()).toEqual({ types: [], search: "", view: "list", page: 1 });
  });

  it("keeps the chips the member tapped", () => {
    expect(parse({ type: ["chill", "outdoors"] }).types).toEqual(["chill", "outdoors"]);
  });

  it("accepts a single chip without an array", () => {
    expect(parse({ type: "movie_night" }).types).toEqual(["movie_night"]);
  });

  /** A query string is typed by anybody. A value that is not a real type
   *  would reach Postgres as an enum it does not have. */
  it("throws away a type that does not exist", () => {
    expect(parse({ type: ["chill", "'; drop table seshes;--"] }).types).toEqual(["chill"]);
  });

  it("drops a repeated chip rather than filtering by it twice", () => {
    expect(parse({ type: ["chill", "chill"] }).types).toEqual(["chill"]);
  });

  it("switches to the map when asked", () => {
    expect(parse({ view: "map" }).view).toBe("map");
  });

  it("falls back to the list for a view it does not have", () => {
    expect(parse({ view: "satellite" }).view).toBe("list");
  });

  it("reads the page number", () => {
    expect(parse({ page: "3" }).page).toBe(3);
  });

  it("refuses a page that is not a page", () => {
    expect(parse({ page: "0" }).page).toBe(1);
    expect(parse({ page: "-4" }).page).toBe(1);
    expect(parse({ page: "banana" }).page).toBe(1);
    expect(parse({ page: "1e9" }).page).toBe(1);
  });

  it("tidies the search text", () => {
    expect(parse({ q: "  blanket  " }).search).toBe("blanket");
  });

  it("will not carry an unbounded search string to the database", () => {
    const huge = "a".repeat(5_000);

    expect(parse({ q: huge }).search.length).toBe(SEARCH_MAX);
  });
});

describe("feedHref", () => {
  it("is just the feed when nothing is filtered", () => {
    expect(feedHref({ types: [], search: "", view: "list", page: 1 })).toBe("/seshes");
  });

  it("carries the chips, the search and the view, so a link can be shared", () => {
    const href = feedHref({ types: ["chill", "outdoors"], search: "blanket", view: "map", page: 2 });

    expect(parseFeedFilters(Object.fromEntries(new URL(href, "http://x").searchParams))).toMatchObject({
      search: "blanket",
      view: "map",
      page: 2,
    });
  });

  it("keeps both chips when the same key repeats", () => {
    const href = feedHref({ types: ["chill", "outdoors"], search: "", view: "list", page: 1 });
    const params = new URL(href, "http://x").searchParams;

    expect(params.getAll("type")).toEqual(["chill", "outdoors"]);
  });

  it("leaves the first page out of the link", () => {
    expect(feedHref({ types: [], search: "", view: "list", page: 1 })).not.toContain("page");
  });
});

describe("page size", () => {
  it("is the twenty the ticket asks for", () => {
    expect(FEED_PAGE_SIZE).toBe(20);
  });
});

/** An empty feed must never read as broken: it says why it is empty and
 *  offers one next step. */
describe("feedEmptyState", () => {
  const none = parse();

  it("offers to clear the chips when they filtered everything out", () => {
    const state = feedEmptyState(parse({ type: "chill", view: "map" }), true);
    expect(state.action).toEqual({ label: "Clear filters", href: "/seshes?view=map" });
  });

  it("offers to clear a search that found nothing", () => {
    expect(feedEmptyState(parse({ q: "karaoke" }), true).action.href).toBe("/seshes");
  });

  it("sends a member who paged past the end back to the start", () => {
    expect(feedEmptyState(parse({ page: "4" }), true).action).toEqual({
      label: "Back to the first page",
      href: "/seshes",
    });
  });

  it("asks a member who can host to host the first one", () => {
    expect(feedEmptyState(none, true).action).toEqual({ label: "Host a sesh", href: "/seshes/new" });
  });

  /** A lapsed card may browse but not host, so "Host a sesh" would be a
   *  dead end. Renewing is the step that opens hosting again. */
  it("sends a member who cannot host to renew their card instead", () => {
    expect(feedEmptyState(none, false).action).toEqual({ label: "Add your renewed card", href: "/verify" });
  });
});
