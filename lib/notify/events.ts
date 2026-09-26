/**
 * A Notification is one thing that happened, addressed to one member (see
 * CONTEXT.md). This file decides which rows a domain event produces — event
 * in, rows out, no database — so every type is tested without one.
 *
 * Server actions call it through notify(); no database trigger writes these
 * rows. A trigger cannot know the human words for a row, cannot be switched
 * off in a test, and hides the fan-out from anyone reading the action.
 *
 * The actor is held as an id only. Nothing here copies a handle into
 * `payload`: the feed looks the handle up when it renders, so a handle change
 * (#70) never leaves an old name behind.
 */

/** The seven, fixed by spec §5. Must match the `notification_type` enum. */
export const NOTIFICATION_TYPES = [
  "rsvp_requested",
  "rsvp_approved",
  "rsvp_denied",
  "sesh_edited",
  "sesh_cancelled",
  "sesh_reminder",
  "card_expiry",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** One insertable row of public.notifications. */
export type NotificationRow = {
  recipient_id: string;
  type: NotificationType;
  sesh_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
};

/** Grows one variant per type as each is wired (#54, #55). */
export type NotifyEvent = { kind: "rsvp_approved"; seshId: string; hostId: string; guestId: string };

export function notificationsFor(event: NotifyEvent): NotificationRow[] {
  const rows: NotificationRow[] = [];
  switch (event.kind) {
    case "rsvp_approved":
      rows.push({ recipient_id: event.guestId, type: "rsvp_approved", sesh_id: event.seshId, actor_id: event.hostId, payload: {} });
      break;
  }
  // Nobody is told about a thing they did themselves.
  return rows.filter((row) => row.recipient_id !== row.actor_id);
}
