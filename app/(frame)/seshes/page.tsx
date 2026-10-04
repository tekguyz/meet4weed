import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedControls } from "@/components/sesh/feed-controls";
import { FeedBoard } from "@/components/sesh/feed-board";
import { WhereYouStand } from "@/components/member/where-you-stand";
import { buttonClass } from "@/components/ui/button";
import { amIAdmin } from "@/lib/admin/queries";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { standing } from "@/lib/member/standing";
import { getMyProfile } from "@/lib/profiles/queries";
import { feedEmptyState, feedHref, parseFeedFilters, type FeedEmptyState, type SearchParams } from "@/lib/sesh/feed-filters";
import { listFeed } from "@/lib/sesh/queries";
import { getMyVerification } from "@/lib/verification/status";
import { TAP_TEXT } from "@/components/ui/focus";

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

  const paging =
    filters.view === "list" && (filters.page > 1 || hasMore) ? (
      <nav className="flex justify-between gap-3" aria-label="More seshes">
        {filters.page > 1 ? (
          <Link href={feedHref({ ...filters, page: filters.page - 1 })} className={`${TAP_TEXT} text-sm text-primary underline`}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={feedHref({ ...filters, page: filters.page + 1 })} className={`${TAP_TEXT} text-sm text-primary underline`}>
            Next
          </Link>
        ) : null}
      </nav>
    ) : null;

  return (
    <FeedBoard
      seshes={seshes}
      view={filters.view}
      viewerId={profile.id}
      now={new Date().toISOString()}
      header={
        <>
          <h1 className="text-3xl">Seshes</h1>
          {mine.kind === "verified" ? null : <WhereYouStand standing={mine} />}
          <FeedControls filters={filters} />
        </>
      }
      footer={paging}
      empty={seshes.length === 0 ? <EmptyFeed {...feedEmptyState(filters, access === "full")} /> : undefined}
    />
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
