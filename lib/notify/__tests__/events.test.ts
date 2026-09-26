/** @vitest-environment node
 *
 *  Issue #50. The seam every notification type is tested through: a domain
 *  event in, the rows it produces out, no database.
 */
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, editIsNewsToGuests, notificationsFor } from "@/lib/notify/events";

const SESH = "11111111-1111-4111-8111-111111111111";
const HOST = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";

// notifications-rls.test.ts proves the database enum takes these same seven.
describe("the notification types", () => {
  it("are exactly the seven spec §5 fixes", () => {
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
});

const GUEST_2 = "44444444-4444-4444-8444-444444444444";

describe("a member asks to join", () => {
  const event = { kind: "rsvp_requested", seshId: SESH, hostId: HOST, guestId: GUEST } as const;

  it("tells the host, and names the guest as the actor", () => {
    expect(notificationsFor(event)).toEqual([
      { recipient_id: HOST, type: "rsvp_requested", sesh_id: SESH, actor_id: GUEST, payload: {} },
    ]);
  });
});

describe("a host says no", () => {
  const event = { kind: "rsvp_denied", seshId: SESH, hostId: HOST, guestId: GUEST, seshTitle: "Porch hang" } as const;

  /** A denied guest loses sight of the sesh, so the feed cannot look the
   *  title up. Without it the row reads "The host of a sesh said no". */
  it("tells the guest, and keeps the title in the payload", () => {
    expect(notificationsFor(event)).toEqual([
      { recipient_id: GUEST, type: "rsvp_denied", sesh_id: SESH, actor_id: HOST, payload: { seshTitle: "Porch hang" } },
    ]);
  });
});

describe("a host edits a sesh", () => {
  const event = { kind: "sesh_edited", seshId: SESH, hostId: HOST, guestIds: [GUEST, GUEST_2] } as const;

  it("writes one row per approved guest, never a rollup", () => {
    const rows = notificationsFor(event);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recipient_id)).toEqual([GUEST, GUEST_2]);
    for (const row of rows) {
      expect(row).toMatchObject({ type: "sesh_edited", sesh_id: SESH, actor_id: HOST, payload: {} });
    }
  });

  it("writes nothing when nobody is approved", () => {
    expect(notificationsFor({ ...event, guestIds: [] })).toEqual([]);
  });

  it("tells a guest listed twice once, and never tells the host", () => {
    const rows = notificationsFor({ ...event, guestIds: [GUEST, GUEST, HOST] });

    expect(rows.map((r) => r.recipient_id)).toEqual([GUEST]);
  });
});

describe("a host cancels a sesh", () => {
  const event = {
    kind: "sesh_cancelled",
    seshId: SESH,
    hostId: HOST,
    guestIds: [GUEST, GUEST_2],
    seshTitle: "Porch hang",
    hostLeaving: false,
  } as const;

  it("writes one row per approved guest, about the sesh, keeping its title", () => {
    const rows = notificationsFor(event);

    expect(rows).toEqual([
      { recipient_id: GUEST, type: "sesh_cancelled", sesh_id: SESH, actor_id: HOST, payload: { seshTitle: "Porch hang" } },
      { recipient_id: GUEST_2, type: "sesh_cancelled", sesh_id: SESH, actor_id: HOST, payload: { seshTitle: "Porch hang" } },
    ]);
  });

  /** On the delete-account path the sesh cascades away a moment later, and
   *  notifications.sesh_id cascades with it. A row pointing at the sesh
   *  would be deleted before any guest read it. */
  it("points at no sesh and no actor when the host is deleting their account", () => {
    const rows = notificationsFor({ ...event, hostLeaving: true });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ sesh_id: null, actor_id: null, payload: { seshTitle: "Porch hang" } });
    }
  });
});

describe("whether an edit is news to the guests", () => {
  const before = {
    startsAt: "2026-10-01T23:00:00+00:00",
    addressLine: "1 Test Street",
    unitNote: "Apt 4",
    gateCode: "1234",
    materiallyChangedAt: null,
  };

  it("is not news when only the title, the seats or the words changed", () => {
    expect(editIsNewsToGuests(before, { ...before })).toBe(false);
  });

  it("is not news when the same instant comes back written differently", () => {
    expect(editIsNewsToGuests(before, { ...before, startsAt: "2026-10-01T23:00:00.000Z" })).toBe(false);
  });

  it.each([
    ["the start moves", { startsAt: "2026-10-01T23:30:00+00:00" }],
    ["the address changes", { addressLine: "2 Test Street" }],
    ["the unit changes", { unitNote: "Apt 5" }],
    ["the gate code changes", { gateCode: "9999" }],
    ["the pin moves far", { materiallyChangedAt: "2026-09-26T12:00:00+00:00" }],
  ])("is news when %s", (_label, change) => {
    expect(editIsNewsToGuests(before, { ...before, ...change })).toBe(true);
  });
});
