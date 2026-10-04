import Link from "next/link";
import { Avatar } from "@/components/member/avatar";
import { DateBlock, SeatMeter, WhenLine } from "@/components/sesh/card-parts";
import { SeshTypeArt } from "@/components/sesh/sesh-type-art";
import { FOCUS_RING } from "@/components/ui/focus";
import type { FeedSesh } from "@/lib/sesh/queries";
import { seshWhen } from "@/lib/sesh/when";

type Props = {
  sesh: FeedSesh;
  /** The signed-in member, so their own sesh reads "Hosted by you". */
  viewerId: string;
  /** ISO time the server rendered at. Passed in, not read here, so the server
   *  and the browser agree on "Tonight" and the page hydrates cleanly. */
  now: string;
  /** Lit from the map on a laptop (#125): its Fuzzy circle was clicked. */
  lit?: boolean;
};

/**
 * One sesh in the feed (#125). A sesh has no photo and its guest list is
 * hidden, so the life comes from the parts: the type drawing, the date block,
 * the Host and the seats filling up. The whole card is one link — a big, easy
 * tap target.
 */
export function SeshCard({ sesh, viewerId, now, lit = false }: Props) {
  const when = seshWhen(new Date(sesh.startsAt), new Date(now));
  const mine = sesh.hostId === viewerId;

  return (
    <Link
      href={`/seshes/${sesh.id}`}
      className={`flex flex-col overflow-hidden rounded-card bg-surface ${lit ? "ring-2 ring-secondary" : ""} ${FOCUS_RING}`}
    >
      <SeshTypeArt type={sesh.seshType} className="h-20" />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <DateBlock when={when} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-lg leading-snug">{sesh.title}</h2>
            <WhenLine when={when} />
            {sesh.areaName ? <p className="text-sm text-ink-muted">{sesh.areaName}</p> : null}
          </div>
        </div>

        {sesh.description ? <p className="line-clamp-2 text-sm text-ink">{sesh.description}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {sesh.host || mine ? (
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
              {sesh.host ? (
                <Avatar
                  seed={sesh.host.avatarSeed}
                  memberId={sesh.hostId}
                  handle={sesh.host.handle}
                  displayName={sesh.host.displayName}
                  className="size-6"
                />
              ) : null}
              <span className="truncate">{mine ? "Hosted by you" : `Hosted by @${sesh.host!.handle}`}</span>
            </p>
          ) : (
            <span />
          )}
          <SeatMeter capacity={sesh.capacity} approved={sesh.approvedCount} />
        </div>
      </div>
    </Link>
  );
}
