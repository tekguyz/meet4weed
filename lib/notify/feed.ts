import type { NotificationType } from "@/lib/notify/events";

/**
 * The feed (issue #52): one row per event, never a rollup. Five people asking
 * to join one sesh is five rows, because the host approves them one at a time.
 *
 * This file turns a row into words and a link — row in, text out, no
 * database — so every type is tested without one.
 */

/** One row of the member's feed, with the names looked up live. */
export type FeedItem = {
  id: string;
  type: NotificationType;
  seshId: string | null;
  /** Null when the sesh is out of the reader's sight (a denied guest). */
  seshTitle: string | null;
  /** Null when the actor's account is gone, or there never was one. */
  actorHandle: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export function describeNotification(item: FeedItem): { text: string; href: string } {
  const actor = item.actorHandle ? `@${item.actorHandle}` : "A member";
  // The live title first, so an edit shows. A writer that knows the reader
  // will lose sight of the sesh keeps the title in the payload.
  const kept = typeof item.payload.seshTitle === "string" ? item.payload.seshTitle : null;
  const title = item.seshTitle ?? kept;
  const sesh = title ?? "a sesh";
  const Sesh = title ?? "A sesh";
  const seshHref = item.seshId ? `/seshes/${item.seshId}` : "/seshes";

  switch (item.type) {
    case "rsvp_requested":
      return { text: `${actor} asked to join ${sesh}.`, href: seshHref };
    case "rsvp_approved":
      return { text: `${actor} approved you for ${sesh}.`, href: seshHref };
    case "rsvp_denied":
      return { text: `The host of ${sesh} said no this time.`, href: "/seshes" };
    case "sesh_edited":
      return { text: `${Sesh} changed. Check the details.`, href: seshHref };
    case "sesh_cancelled":
      return { text: `${Sesh} was cancelled.`, href: seshHref };
    case "sesh_reminder":
      return { text: `${Sesh} starts soon.`, href: seshHref };
    case "card_expiry":
      return { text: "Your card expires soon. Renew it to keep full access.", href: "/verify" };
  }
}
