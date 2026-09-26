/** @vitest-environment node
 *
 *  ADR 0002: what a push says on a locked screen names no member and no sesh.
 *  The OS shows it to whoever holds the phone. This file is the test that
 *  stops somebody "finishing" the push text by adding a name or a title.
 */
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, notificationsFor, type NotifyEvent } from "@/lib/notify/events";
import { pushMessage } from "@/lib/notify/push-text";

const SESH = "11111111-1111-4111-8111-111111111111";
const HOST = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";
const TITLE = "Thursday Smoke Sesh at Dana's";
const HANDLES = ["dana", "sam_420"];

/** One of every event, carrying every name the app could know. */
const EVENTS: NotifyEvent[] = [
  { kind: "rsvp_requested", seshId: SESH, hostId: HOST, guestId: GUEST },
  { kind: "rsvp_approved", seshId: SESH, hostId: HOST, guestId: GUEST },
  { kind: "rsvp_denied", seshId: SESH, hostId: HOST, guestId: GUEST, seshTitle: TITLE },
  { kind: "sesh_edited", seshId: SESH, hostId: HOST, guestIds: [GUEST] },
  { kind: "sesh_cancelled", seshId: SESH, hostId: HOST, guestIds: [GUEST], seshTitle: TITLE, hostLeaving: false },
  { kind: "sesh_cancelled", seshId: SESH, hostId: HOST, guestIds: [GUEST], seshTitle: TITLE, hostLeaving: true },
  { kind: "sesh_reminder", seshId: SESH, hostId: HOST, startsAt: "2026-10-01T22:00:00Z", guestIds: [GUEST] },
  { kind: "card_expiry", memberId: GUEST, cardExpiresOn: "2026-10-03", rung: 7 },
  { kind: "guest_card_expiry", seshId: SESH, hostId: HOST, guestId: GUEST, cardExpiresOn: "2026-10-03" },
];

/** Every row, with handles added to the payload too, as a future feed might. */
const ROWS = EVENTS.flatMap(notificationsFor).map((row) => ({
  ...row,
  payload: { ...row.payload, seshTitle: TITLE, actorHandle: HANDLES[0], hostHandle: HANDLES[1] },
}));

describe("push text on a locked screen", () => {
  it("covers every notification type", () => {
    expect(new Set(ROWS.map((r) => r.type))).toEqual(new Set(NOTIFICATION_TYPES));
  });

  it.each(ROWS.map((row) => [row.type, row] as const))("%s names no member and no sesh", (_type, row) => {
    // The whole message the service worker receives, not only title and body:
    // anything in it could end up on the screen.
    const sent = JSON.stringify(pushMessage(row)).toLowerCase();

    expect(sent).not.toContain(TITLE.toLowerCase());
    expect(sent).not.toContain("thursday");
    for (const handle of HANDLES) expect(sent).not.toContain(handle);
    for (const id of [SESH, HOST, GUEST]) expect(sent).not.toContain(id);
  });

  it("says only that there is an update, for anything a person did", () => {
    for (const type of ["rsvp_requested", "rsvp_approved", "rsvp_denied", "sesh_edited", "sesh_cancelled"] as const) {
      const row = ROWS.find((r) => r.type === type)!;
      expect(pushMessage(row)).toMatchObject({ title: "Meet4Weed", body: "You have an update." });
    }
  });

  it("lets a reminder say a little more, because it names nobody", () => {
    const row = ROWS.find((r) => r.type === "sesh_reminder")!;
    expect(pushMessage(row).body).toBe("A sesh you are going to starts within a day.");
  });

  it("opens the feed when tapped, which is behind sign-in", () => {
    for (const row of ROWS) expect(pushMessage(row).url).toBe("/notifications");
  });
});
