import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedControls } from "@/components/sesh/feed-controls";
import { FeedMap } from "@/components/sesh/feed-map";
import { WhereYouStand } from "@/components/member/where-you-stand";
import { buttonClass } from "@/components/ui/button";
import { amIAdmin } from "@/lib/admin/queries";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { standing } from "@/lib/member/standing";
import { getMyProfile } from "@/lib/profiles/queries";
import { feedEmptyState, feedHref, parseFeedFilters, type FeedEmptyState, type SearchParams } from "@/lib/sesh/feed-filters";
import { listFeed, type SeshListItem } from "@/lib/sesh/queries";
import { SESH_TYPE_LABELS } from "@/lib/sesh/schema";
import { getMyVerification } from "@/lib/verification/status";

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

  const today = floridaToday();
  const access = memberAccess(profile, today);

  // RLS gives a member who cannot browse an empty feed, which reads as broken.
  // Their tab is hidden; a typed URL goes to their where-you-stand card.
  if (frameAccess(access, await amIAdmin()).home !== "/seshes") redirect("/");

  // Expiring soon, expired, or a renewal that did not go through. A browsing
  // member never sees `/`, so the card rides at the top of the feed.
  const mine = standing(profile, access === "full" ? null : await getMyVerification(), today);

  const filters = parseFeedFilters(await searchParams);
  const { seshes, hasMore } = await listFeed(filters);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl">Seshes</h1>

      {mine.kind === "verified" ? null : <WhereYouStand standing={mine} />}

      <FeedControls filters={filters} />

      {seshes.length === 0 ? (
        <EmptyFeed {...feedEmptyState(filters, access === "full")} />
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
            <Link href={feedHref({ ...filters, page: filters.page - 1 })} className="inline-flex min-h-11 items-center text-sm text-primary underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link href={feedHref({ ...filters, page: filters.page + 1 })} className="inline-flex min-h-11 items-center text-sm text-primary underline">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function EmptyFeed({ message, action }: FeedEmptyState) {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <p className="text-sm text-ink-muted">{message}</p>
      <Link href={action.href} className={buttonClass()}>
        {action.label}
      </Link>
    </div>
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
