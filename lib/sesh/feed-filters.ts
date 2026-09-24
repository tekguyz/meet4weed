import { SESH_TYPES, type SeshType } from "@/lib/sesh/schema";

/**
 * The feed's whole state lives in the URL: the chips, the search text and
 * whether it is a list or a map. That makes a filtered feed a link somebody
 * can send, and it survives a reload.
 *
 * Everything here arrives from a query string, so nothing is trusted. A type
 * that is not one of ours is dropped rather than passed on to Postgres as an
 * enum value it does not have, and the search text is capped rather than
 * handed to the database at whatever length a URL can carry.
 */

export type FeedView = "list" | "map";

export type FeedFilters = {
  types: SeshType[];
  search: string;
  view: FeedView;
  page: number;
};

export const FEED_PAGE_SIZE = 20;

/** The map draws circles, not a list, so it takes a wider slice in one go
 *  rather than paging. Past this, a phone is drawing soup anyway. */
export const MAP_LIMIT = 200;

export const SEARCH_MAX = 80;

/** What Next hands a page. */
export type SearchParams = Record<string, string | string[] | undefined>;

function values(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function first(raw: string | string[] | undefined): string {
  return values(raw)[0] ?? "";
}

const isSeshType = (value: string): value is SeshType => (SESH_TYPES as readonly string[]).includes(value);

function parsePage(raw: string): number {
  // Deliberately strict: "1e9" and " 3 " are not page numbers, and Number()
  // would happily turn the first into a billion-row offset.
  if (!/^\d{1,4}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 ? page : 1;
}

export function parseFeedFilters(params: SearchParams): FeedFilters {
  const types = [...new Set(values(params.type).filter(isSeshType))];
  const view = first(params.view) === "map" ? "map" : "list";

  return {
    types,
    search: first(params.q).trim().slice(0, SEARCH_MAX),
    view,
    page: parsePage(first(params.page)),
  };
}

/** The inverse. Defaults are left out so an unfiltered feed is just
 *  `/seshes` rather than a wall of empty parameters. */
export function feedHref(filters: FeedFilters): string {
  const params = new URLSearchParams();
  for (const type of filters.types) params.append("type", type);
  if (filters.search) params.set("q", filters.search);
  if (filters.view === "map") params.set("view", "map");
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `/seshes?${query}` : "/seshes";
}

export type FeedEmptyState = {
  message: string;
  action: { label: string; href: string };
};

/** What an empty feed says, and the one next step it offers. An empty screen
 *  with no way forward reads as broken. `canHost` is false for a lapsed card,
 *  which may browse but not host. */
export function feedEmptyState(filters: FeedFilters, canHost: boolean): FeedEmptyState {
  if (filters.types.length > 0 || filters.search) {
    return {
      message: "Nothing matches that. Try fewer chips, or a different word.",
      action: { label: "Clear filters", href: feedHref({ ...filters, types: [], search: "", page: 1 }) },
    };
  }
  if (filters.page > 1) {
    return {
      message: "There are no more seshes past this page.",
      action: { label: "Back to the first page", href: feedHref({ ...filters, page: 1 }) },
    };
  }
  return canHost
    ? {
        message: "No seshes are listed right now. Yours could be the first one people see.",
        action: { label: "Host a sesh", href: "/seshes/new" },
      }
    : {
        message: "No seshes are listed right now. Once your card is renewed, you can host one.",
        action: { label: "Add your renewed card", href: "/verify" },
      };
}
