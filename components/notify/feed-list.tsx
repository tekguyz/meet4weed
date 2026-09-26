import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus";
import { describeNotification, type FeedItem } from "@/lib/notify/feed";

/** Florida time, like every other time in the app. */
const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Renders the member's feed, or the empty state. It decides nothing.
 *
 * The rows are whatever the select policy returned. An empty list IS the
 * empty state — the way AddressPanel renders a locked address from no rows —
 * so there is no member id, no status and no count here.
 */
export function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-card bg-surface p-4 text-sm text-ink-muted">
        Nothing yet. When somebody asks to join your sesh, or a host lets you in, it shows up here.{" "}
        <Link href="/seshes" className="underline">
          Find a sesh
        </Link>{" "}
        to start.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-rule overflow-hidden rounded-card bg-surface">
      {items.map((item) => {
        const { text, href } = describeNotification(item);
        const unread = item.readAt === null;
        return (
          <li key={item.id}>
            <Link
              href={href}
              data-unread={unread || undefined}
              className={`flex min-h-11 gap-3 px-4 py-3 hover:bg-surface-2 ${FOCUS_RING}`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-secondary" : "bg-transparent"}`}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`break-words text-sm ${unread ? "font-semibold text-ink" : "text-ink"}`}>
                  {unread ? <span className="sr-only">New: </span> : null}
                  {text}
                </span>
                <time dateTime={item.createdAt} className="text-xs text-ink-muted">
                  {WHEN.format(new Date(item.createdAt))} ET
                </time>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
