import { seats } from "@/lib/sesh/seats";
import type { SeshWhen } from "@/lib/sesh/when";

/**
 * The sesh card's parts (#125), shared by the feed card and the sesh page.
 * Each one shows a picture to the eye and reads one plain sentence to a
 * screen reader; the picture is hidden from it.
 */

/** A calendar tile: "Oct" over a big "9". Florida's date, from seshWhen. */
export function DateBlock({ when }: { when: SeshWhen }) {
  return (
    <span
      aria-hidden="true"
      className="flex w-14 shrink-0 flex-col items-center rounded-control bg-surface-2 py-1.5 tabular-nums"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{when.month}</span>
      <span className="text-2xl leading-7 font-semibold text-ink">{when.day}</span>
    </span>
  );
}

/** "Tonight · 8:00 PM ET" beside the tile. Tonight, Today and Tomorrow are
 *  Honey, the accent voice: they are what a scanning eye looks for. */
export function WhenLine({ when }: { when: SeshWhen }) {
  return (
    <time dateTime={when.iso} className="text-sm text-ink-muted">
      <span aria-hidden="true">
        <span className={when.soon ? "font-semibold text-secondary" : undefined}>{when.label}</span>
        {` · ${when.time} ET`}
      </span>
      <span className="sr-only">{when.sentence}</span>
    </time>
  );
}

/**
 * The room filling up: one dot per seat up to twelve, a bar and "18 of 40"
 * above that, and "Full" once every seat is taken. Counts only — never a name
 * or a face, because the guest list is hidden from everyone but the Host and
 * approved guests.
 */
/** Two friendly figures that say "people" before the dots do. Drawn in the
 *  frame's line style (24px grid, 1.75 stroke, round ends), and never a face:
 *  the seats carry counts only. */
function People() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 13.7a6.5 6.5 0 0 1 3.5 6.3" />
    </svg>
  );
}

export function SeatMeter({ capacity, approved }: { capacity: number; approved: number }) {
  const room = seats(capacity, approved);

  return (
    <p className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="sr-only">{room.sentence}</span>
      <People />
      {room.kind === "dots" ? (
        <span aria-hidden="true" className="flex flex-wrap gap-1">
          {room.dots.map((taken, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${taken ? "bg-secondary" : "border border-ink-muted/70"}`}
            />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full bg-secondary" style={{ width: `${(room.taken / room.capacity) * 100}%` }} />
        </span>
      )}
      <span aria-hidden="true" className="tabular-nums">
        {room.count}
      </span>
      {room.full ? (
        <span aria-hidden="true" className="font-semibold text-secondary">
          Full
        </span>
      ) : null}
    </p>
  );
}
