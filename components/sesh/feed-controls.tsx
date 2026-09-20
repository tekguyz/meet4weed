import Link from "next/link";
import { feedHref, type FeedFilters } from "@/lib/sesh/feed-filters";
import { SESH_TYPES, SESH_TYPE_LABELS } from "@/lib/sesh/schema";

/** Links and a GET form, not a router dance.
 *
 *  The feed's whole state lives in the URL, so every control here is an
 *  ordinary navigation. A filtered feed is then a link somebody can send, the
 *  back button does what it should, and none of it needs JavaScript. */
export function FeedControls({ filters }: { filters: FeedFilters }) {
  const withTypeToggled = (type: (typeof SESH_TYPES)[number]) => {
    const on = filters.types.includes(type);
    return feedHref({
      ...filters,
      types: on ? filters.types.filter((t) => t !== type) : [...filters.types, type],
      // Page four of the old filter is meaningless under the new one.
      page: 1,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SESH_TYPES.map((type) => {
          const on = filters.types.includes(type);
          return (
            <Link
              key={type}
              href={withTypeToggled(type)}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 rounded-control px-3 py-2 text-sm ${
                on ? "bg-primary text-on-primary" : "bg-surface-2 text-ink"
              }`}
            >
              {SESH_TYPE_LABELS[type]}
            </Link>
          );
        })}
      </div>

      <form role="search" method="get" action="/seshes" className="flex gap-2">
        {filters.types.map((type) => (
          <input key={type} type="hidden" name="type" value={type} />
        ))}
        {filters.view === "map" ? <input type="hidden" name="view" value="map" /> : null}

        <label htmlFor="feed-search" className="sr-only">
          Search seshes
        </label>
        <input
          id="feed-search"
          type="search"
          name="q"
          defaultValue={filters.search}
          placeholder="Search seshes"
          maxLength={80}
          className="flex-1 rounded-control border border-rule bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
        <button type="submit" className="rounded-control bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
          Search
        </button>
      </form>

      <div className="flex gap-2">
        <Link
          href={feedHref({ ...filters, view: "list", page: 1 })}
          aria-current={filters.view === "list" ? "true" : undefined}
          className={`rounded-control px-3 py-2 text-sm ${
            filters.view === "list" ? "bg-primary text-on-primary" : "bg-surface-2 text-ink"
          }`}
        >
          List
        </Link>
        <Link
          href={feedHref({ ...filters, view: "map", page: 1 })}
          aria-current={filters.view === "map" ? "true" : undefined}
          className={`rounded-control px-3 py-2 text-sm ${
            filters.view === "map" ? "bg-primary text-on-primary" : "bg-surface-2 text-ink"
          }`}
        >
          Map
        </Link>
      </div>
    </div>
  );
}
