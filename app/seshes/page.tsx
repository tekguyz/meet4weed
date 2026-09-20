import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedControls } from "@/components/sesh/feed-controls";
import { FeedMap } from "@/components/sesh/feed-map";
import { floridaToday } from "@/lib/dates";
import { memberAccess } from "@/lib/member/gate";
import { getMyProfile } from "@/lib/profiles/queries";
import { feedHref, parseFeedFilters, type SearchParams } from "@/lib/sesh/feed-filters";
import { listFeed, type SeshListItem } from "@/lib/sesh/queries";
import { SESH_TYPE_LABELS } from "@/lib/sesh/schema";

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function SeshesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const access = memberAccess(profile, floridaToday());

  // The database already returns an unverified member nothing. This is so
  // they read a sentence rather than an empty feed and think it is broken.
  if (access === "unverified" || access === "pending" || access === "suspended") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl">Almost there</h1>
        <p className="text-sm text-ink-muted">
          {access === "pending"
            ? "A person is checking your card. Seshes open up as soon as that is done."
            : access === "suspended"
              ? "This account cannot browse seshes."
              : "Seshes are for verified patients. Add your card and a person will check it."}
        </p>
        {access === "unverified" ? (
          <Link href="/verify" className="text-sm font-semibold text-primary underline">
            Verify your card
          </Link>
        ) : null}
        <Link href="/" className="text-sm text-ink-muted underline">
          Back
        </Link>
      </main>
    );
  }

  const filters = parseFeedFilters(await searchParams);
  const { seshes, hasMore } = await listFeed(filters);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl">Seshes</h1>
        <Link href="/seshes/mine" className="text-sm font-semibold text-primary underline">
          My seshes
        </Link>
      </header>

      {access === "read_only" ? (
        <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink">
          Your card has expired, so you can look but not join or host.{" "}
          <Link href="/verify" className="underline">
            Add your renewed card
          </Link>{" "}
          to get the rest back.
        </p>
      ) : null}

      <FeedControls filters={filters} />

      {seshes.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing matches yet. Try fewer chips, or a different word.
        </p>
      ) : filters.view === "map" ? (
        <FeedMap
          circles={seshes
            .filter((sesh) => sesh.fuzzyLat !== null && sesh.fuzzyLng !== null)
            .map((sesh) => ({
              id: sesh.id,
              lat: sesh.fuzzyLat!,
              lng: sesh.fuzzyLng!,
              radiusM: sesh.fuzzyRadiusM,
            }))}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {seshes.map((sesh) => (
            <li key={sesh.id}>
              <FeedCard sesh={sesh} />
            </li>
          ))}
        </ul>
      )}

      {filters.view === "list" && (filters.page > 1 || hasMore) ? (
        <nav className="flex justify-between gap-3" aria-label="More seshes">
          {filters.page > 1 ? (
            <Link href={feedHref({ ...filters, page: filters.page - 1 })} className="text-sm text-primary underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link href={feedHref({ ...filters, page: filters.page + 1 })} className="text-sm text-primary underline">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}

      <Link href="/" className="text-sm text-ink-muted underline">
        Back
      </Link>
    </main>
  );
}

function FeedCard({ sesh }: { sesh: SeshListItem }) {
  const left = Math.max(sesh.capacity - sesh.approvedCount, 0);

  return (
    <article className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{sesh.title}</h2>
        <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-muted">
          {SESH_TYPE_LABELS[sesh.seshType]}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{WHEN.format(new Date(sesh.startsAt))} ET</p>
      <p className="text-sm text-ink-muted">
        {sesh.areaName ? `${sesh.areaName} · ` : ""}
        {left === 0 ? "full" : `${left} spot${left === 1 ? "" : "s"} left`}
      </p>
      {sesh.description ? <p className="line-clamp-2 text-sm text-ink">{sesh.description}</p> : null}
    </article>
  );
}
