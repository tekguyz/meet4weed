"use client";

import { useEffect } from "react";
import { markSeen } from "@/app/(frame)/notifications/actions";
import { SEEN_EVENT } from "@/components/frame/bell";

/**
 * Marks the rows the page showed as read, once the page is on screen. It is a
 * client effect and not a write during render, so a prefetch of the page never
 * marks anything. The page keeps showing them as new until the next visit, so
 * the member can still see what was new.
 */
export function MarkSeen({ ids }: { ids: string[] }) {
  const key = ids.join(",");

  useEffect(() => {
    if (key === "") return;
    markSeen(key.split(","))
      .then(() => window.dispatchEvent(new Event(SEEN_EVENT)))
      .catch(() => {});
  }, [key]);

  return null;
}
