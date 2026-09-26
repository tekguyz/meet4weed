/** @vitest-environment node
 *
 *  Issue #50. The seam every notification type is tested through: a domain
 *  event in, the rows it produces out, no database.
 */
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, notificationsFor } from "@/lib/notify/events";

const SESH = "11111111-1111-4111-8111-111111111111";
const HOST = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";

describe("the notification types", () => {
  it("are exactly the seven spec §5 fixes, matching the database enum", () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual(
      [
        "card_expiry",
        "rsvp_approved",
        "rsvp_denied",
        "rsvp_requested",
        "sesh_cancelled",
        "sesh_edited",
        "sesh_reminder",
      ].sort(),
    );
  });
});

describe("a host approves an RSVP", () => {
  const event = { kind: "rsvp_approved", seshId: SESH, hostId: HOST, guestId: GUEST } as const;

  it("produces exactly one row", () => {
    expect(notificationsFor(event)).toHaveLength(1);
  });

  it("addresses it to the guest, about the sesh, done by the host", () => {
    const [row] = notificationsFor(event);

    expect(row).toMatchObject({ recipient_id: GUEST, type: "rsvp_approved", sesh_id: SESH, actor_id: HOST });
  });

  /** A handle copied here would outlive a handle change (#70). The feed looks
   *  the actor up by id when it renders. */
  it("copies no handle into the payload", () => {
    const [row] = notificationsFor(event);

    expect(row.payload).toEqual({});
  });

  it("never tells a member about their own action", () => {
    expect(notificationsFor({ ...event, guestId: HOST })).toEqual([]);
  });
});
