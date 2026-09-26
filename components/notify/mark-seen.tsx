"use client";

import { useEffect } from "react";
import { markSeenThrough } from "@/app/(frame)/notifications/actions";
import { NOTIFICATIONS_SEEN_EVENT } from "@/lib/notify/feed";

/**
 * Marks the feed read up to the newest row the page showed, once the page is
 * on screen. Older unread rows past the page's limit are cleared too, so the
 * count can always reach zero; a row that landed after the render is not. It is a
 * client effect and not a write during render, so a prefetch of the page never
 * marks anything. The page keeps showing them as new until the next visit, so
 * the member can still see what was new.
 */
export function MarkSeen({ through }: { through: string | null }) {
  useEffect(() => {
    if (through === null) return;
    markSeenThrough(through)
      .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_SEEN_EVENT)))
      .catch(() => {});
  }, [through]);

  return null;
}
