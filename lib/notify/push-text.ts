import type { NotificationRow } from "@/lib/notify/events";

/**
 * What a push says. READ docs/adr/0002-discreet-push-text.md BEFORE CHANGING
 * THIS. The operating system shows it on a locked screen to whoever holds
 * the phone, so it names no member and no sesh — ever. It takes the row's
 * type and nothing else, so it has nothing to leak. It is plain on purpose;
 * it is not an unfinished feature. lib/notify/__tests__/push-text.test.ts
 * holds the line.
 *
 * Tapping opens the feed, which is behind sign-in and is the truth anyway.
 */
export type PushMessage = { title: string; body: string; url: string; tag: string };

const UPDATE = "You have an update.";

const BODY: Record<NotificationRow["type"], string> = {
  rsvp_requested: UPDATE,
  rsvp_approved: UPDATE,
  rsvp_denied: UPDATE,
  sesh_edited: UPDATE,
  sesh_cancelled: UPDATE,
  // Reminders name nobody, so they may say a little more.
  sesh_reminder: "A sesh you are going to starts within a day.",
  card_expiry: UPDATE,
};

export function pushMessage(row: Pick<NotificationRow, "type">): PushMessage {
  return {
    title: "Meet4Weed",
    body: BODY[row.type],
    url: "/notifications",
    // One tag, so a burst of updates is one notice on the screen, not five.
    tag: "m4w-update",
  };
}
