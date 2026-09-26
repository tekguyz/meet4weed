import type { NotificationType } from "@/lib/notify/events";

/**
 * The notification feed (issue #52): one row per event, never a rollup. Five people asking
 * to join one sesh is five rows, because the host approves them one at a time.
 *
 * This file turns a row into words and a link — row in, text out, no
 * database — so every type is tested without one.
 */

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Fired in the browser once the notification feed has marked its rows read,
 *  so the bell re-reads its count. */
export const NOTIFICATIONS_SEEN_EVENT = "m4w:notifications-seen";

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
  // The live title first, so an edit shows. A denied guest loses sight of the
  // sesh, so the denial's writer (#54) keeps the title in the payload.
  const kept = typeof item.payload.seshTitle === "string" ? item.payload.seshTitle : null;
  const title = item.seshTitle ?? kept;
  const seshMidSentence = title ?? "a sesh";
  const seshOpening = title ?? "A sesh";
  const seshHref = item.seshId ? `/seshes/${item.seshId}` : "/seshes";

  switch (item.type) {
    case "rsvp_requested":
      return { text: `${actor} asked to join ${seshMidSentence}.`, href: seshHref };
    case "rsvp_approved":
      return { text: `${actor} approved you for ${seshMidSentence}.`, href: seshHref };
    case "rsvp_denied":
      return { text: `The host of ${seshMidSentence} said no this time.`, href: "/seshes" };
    case "sesh_edited":
      return { text: `${seshOpening} changed. Check the details.`, href: seshHref };
    case "sesh_cancelled":
      return { text: `${seshOpening} was cancelled.`, href: seshHref };
    case "sesh_reminder":
      return { text: `${seshOpening} starts soon.`, href: seshHref };
    case "card_expiry": {
      const cardDate = typeof item.payload.cardExpiresOn === "string" ? SHORT_DATE.format(new Date(`${item.payload.cardExpiresOn}T00:00:00Z`)) : null;
      // The host's form (#55): a guest's card lapses before the sesh, and
      // the guest loses their spot unless they renew. Spec §4.3.
      if (item.payload.about === "guest") {
        const when = cardDate ? ` ${cardDate},` : "";
        return {
          text: `${actor}'s card expires${when} before ${seshMidSentence}. They lose the address unless they renew.`,
          href: seshHref,
        };
      }
      const when = cardDate ? ` ${cardDate}` : " soon";
      return { text: `Your card expires${when}. Renew it to keep full access.`, href: "/verify" };
    }
  }
}
