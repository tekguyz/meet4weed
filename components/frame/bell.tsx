"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { unreadCount } from "@/app/(frame)/notifications/actions";
import { FOCUS_RING } from "@/components/ui/focus";
import { NOTIFICATIONS_SEEN_EVENT } from "@/lib/notify/feed";

/**
 * The bell and its unread count (issue #52). Push is best-effort (spec §8), so
 * the feed is the only guaranteed channel, and without a count nobody opens it.
 *
 * It starts from the number the layout read, then re-reads on every later
 * navigation and whenever the notification feed says it marked rows read.
 */
export function Bell({ initial }: { initial: number }) {
  const pathname = usePathname();
  const [count, setCount] = useState(initial);
  // The layout has just read the count; asking again on mount is a wasted trip.
  const mounted = useRef(false);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      unreadCount()
        .then((n) => {
          if (live) setCount(n);
        })
        .catch(() => {});
    };
    if (mounted.current) refresh();
    mounted.current = true;
    window.addEventListener(NOTIFICATIONS_SEEN_EVENT, refresh);
    return () => {
      live = false;
      window.removeEventListener(NOTIFICATIONS_SEEN_EVENT, refresh);
    };
  }, [pathname]);

  const label = count === 0 ? "Notifications" : `Notifications, ${count} unread`;
  const here = pathname === "/notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={here ? "page" : undefined}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-control ${here ? "text-primary" : "text-ink-muted hover:text-ink"} ${FOCUS_RING}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6 md:size-5"
      >
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-count
          className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold leading-5 tabular-nums text-on-primary"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
