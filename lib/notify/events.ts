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

/** The action-driven types. The clock-driven two, sesh_reminder and
 *  card_expiry, land with the scheduler (#55).
 *
 *  There is deliberately no contribution notification. A busy feed gets
 *  ignored, and that kills the notices that matter (#54). */
export type NotifyEvent =
  | { kind: "rsvp_requested"; seshId: string; hostId: string; guestId: string }
  | { kind: "rsvp_approved"; seshId: string; hostId: string; guestId: string }
  | { kind: "rsvp_denied"; seshId: string; hostId: string; guestId: string; seshTitle: string | null }
  | { kind: "sesh_edited"; seshId: string; hostId: string; guestIds: readonly string[] }
  | {
      kind: "sesh_cancelled";
      seshId: string;
      hostId: string;
      guestIds: readonly string[];
      seshTitle: string;
      /** The host is deleting their account (#71). The sesh cascades away a
       *  moment later, and a row pointing at it would cascade with it. */
      hostLeaving: boolean;
    };

export function notificationsFor(event: NotifyEvent): NotificationRow[] {
  switch (event.kind) {
    case "rsvp_requested":
      return [{ recipient_id: event.hostId, type: "rsvp_requested", sesh_id: event.seshId, actor_id: event.guestId, payload: {} }];
    case "rsvp_approved":
      return [{ recipient_id: event.guestId, type: "rsvp_approved", sesh_id: event.seshId, actor_id: event.hostId, payload: {} }];
    case "rsvp_denied":
      // A denied guest loses sight of the sesh, so the feed cannot look the
      // title up for them. The row keeps it.
      return [
        {
          recipient_id: event.guestId,
          type: "rsvp_denied",
          sesh_id: event.seshId,
          actor_id: event.hostId,
          payload: { seshTitle: event.seshTitle },
        },
      ];
    case "sesh_edited":
      return guestsOf(event).map((guest) => ({
        recipient_id: guest,
        type: "sesh_edited",
        sesh_id: event.seshId,
        actor_id: event.hostId,
        payload: {},
      }));
    case "sesh_cancelled":
      // The title rides on every cancel, because on the delete path the sesh
      // itself is about to vanish.
      return guestsOf(event).map((guest) => ({
        recipient_id: guest,
        type: "sesh_cancelled",
        sesh_id: event.hostLeaving ? null : event.seshId,
        actor_id: event.hostLeaving ? null : event.hostId,
        payload: { seshTitle: event.seshTitle },
      }));
  }
}

/** One row per guest, never a rollup. A guest listed twice is still one
 *  person, and a host is never their own guest. */
function guestsOf(event: { hostId: string; guestIds: readonly string[] }): string[] {
  return [...new Set(event.guestIds)].filter((id) => id !== event.hostId);
}

/** The facts a guest travels on: when, where, and how to get in. */
export type WhenAndWhere = {
  startsAt: string;
  addressLine: string | null;
  unitNote: string | null;
  gateCode: string | null;
  /** Stamped by the database when the pin moves far (the materially_changed
   *  migrations). A nudge across the garden stamps nothing. */
  materiallyChangedAt: string | null;
};

/** Whether an edit could send a guest to the wrong time or the wrong door.
 *  A new title or one more seat is not news: a busy feed gets ignored. */
export function editIsNewsToGuests(before: WhenAndWhere, after: WhenAndWhere): boolean {
  return (
    new Date(before.startsAt).getTime() !== new Date(after.startsAt).getTime() ||
    before.addressLine !== after.addressLine ||
    before.unitNote !== after.unitNote ||
    before.gateCode !== after.gateCode ||
    before.materiallyChangedAt !== after.materiallyChangedAt
  );
}
