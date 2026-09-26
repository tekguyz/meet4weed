/** @vitest-environment node
 *
 *  Issue #50. The seam every notification type is tested through: a domain
 *  event in, the rows it produces out, no database.
 */
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  NOTIFICATION_TYPES,
  cardExpiryRung,
  editIsNewsToGuests,
  guestCardLapsesBefore,
  notificationsFor,
} from "@/lib/notify/events";

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

// Issue #55 — the two clock-driven types. The cron job runs them daily, so
// each row carries a dedup_key and the unique index turns a second run into a
// no-op. The key is part of the contract, so the tests pin it.

describe("a sesh starts within the next day", () => {
  const event = {
    kind: "sesh_reminder",
    seshId: SESH,
    hostId: HOST,
    startsAt: "2026-09-27T18:00:00+00:00",
    guestIds: [GUEST, GUEST_2],
  } as const;

  it("reminds every approved guest, one row each, named by nobody", () => {
    expect(notificationsFor(event)).toEqual([
      { recipient_id: GUEST, type: "sesh_reminder", sesh_id: SESH, actor_id: null, payload: {}, dedup_key: `${SESH}@2026-09-27T18:00:00.000Z` },
      { recipient_id: GUEST_2, type: "sesh_reminder", sesh_id: SESH, actor_id: null, payload: {}, dedup_key: `${SESH}@2026-09-27T18:00:00.000Z` },
    ]);
  });

  it("never reminds the host, and reminds a guest listed twice once", () => {
    const rows = notificationsFor({ ...event, guestIds: [GUEST, GUEST, HOST] });
    expect(rows.map((row) => row.recipient_id)).toEqual([GUEST]);
  });

  it("keys the reminder to the start time, so a sesh moved to another day earns a new one", () => {
    const [before] = notificationsFor(event);
    const [after] = notificationsFor({ ...event, startsAt: "2026-10-04T18:00:00Z" });
    expect(before.dedup_key).not.toBe(after.dedup_key);
  });
});

describe("a member's card nears expiry", () => {
  it("tells the member, keyed to the card date and the rung", () => {
    expect(notificationsFor({ kind: "card_expiry", memberId: GUEST, cardExpiresOn: "2026-10-03", rung: 7 })).toEqual([
      {
        recipient_id: GUEST,
        type: "card_expiry",
        sesh_id: null,
        actor_id: null,
        payload: { about: "self", cardExpiresOn: "2026-10-03" },
        dedup_key: "self:2026-10-03:7",
      },
    ]);
  });
});

describe("the ladder in spec §4.3: push at 7 days and at 1 day", () => {
  it.each([
    [8, null],
    [7, 7],
    [2, 7],
    [1, 1],
    // The expiry date itself is the one email's job (Plan 02).
    [0, null],
    [-3, null],
  ] as const)("a card %i days out is on rung %s", (days, rung) => {
    expect(cardExpiryRung("2026-09-26", addDays("2026-09-26", days))).toBe(rung);
  });
});

describe("an approved guest's card lapses before the sesh", () => {
  const event = { kind: "guest_card_expiry", seshId: SESH, hostId: HOST, guestId: GUEST, cardExpiresOn: "2026-10-03" } as const;

  it("tells the host once, about that guest and that sesh", () => {
    expect(notificationsFor(event)).toEqual([
      {
        recipient_id: HOST,
        type: "card_expiry",
        sesh_id: SESH,
        actor_id: GUEST,
        payload: { about: "guest", cardExpiresOn: "2026-10-03" },
        dedup_key: `${SESH}:${GUEST}:2026-10-03`,
      },
    ]);
  });

  it("counts a card as valid through the whole of its expiry day, in Florida", () => {
    // 11pm in Florida on Oct 3 is already Oct 4 in UTC.
    expect(guestCardLapsesBefore("2026-10-03", "2026-10-04T03:00:00Z")).toBe(false);
    expect(guestCardLapsesBefore("2026-10-03", "2026-10-04T15:00:00Z")).toBe(true);
    expect(guestCardLapsesBefore("2026-10-05", "2026-10-04T15:00:00Z")).toBe(false);
  });
});

describe("every one of the seven types", () => {
  it("is produced by some event", () => {
    const produced = new Set(
      [
        notificationsFor({ kind: "rsvp_requested", seshId: SESH, hostId: HOST, guestId: GUEST }),
        notificationsFor({ kind: "rsvp_approved", seshId: SESH, hostId: HOST, guestId: GUEST }),
        notificationsFor({ kind: "rsvp_denied", seshId: SESH, hostId: HOST, guestId: GUEST, seshTitle: "t" }),
        notificationsFor({ kind: "sesh_edited", seshId: SESH, hostId: HOST, guestIds: [GUEST] }),
        notificationsFor({ kind: "sesh_cancelled", seshId: SESH, hostId: HOST, guestIds: [GUEST], seshTitle: "t", hostLeaving: false }),
        notificationsFor({ kind: "sesh_reminder", seshId: SESH, hostId: HOST, startsAt: "2026-09-27T18:00:00Z", guestIds: [GUEST] }),
        notificationsFor({ kind: "card_expiry", memberId: GUEST, cardExpiresOn: "2026-10-03", rung: 1 }),
      ]
        .flat()
        .map((row) => row.type),
    );
    expect([...produced].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });
});
