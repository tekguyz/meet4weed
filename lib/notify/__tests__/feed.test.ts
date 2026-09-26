/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { describeNotification, type FeedItem } from "@/lib/notify/feed";

const SESH = "11111111-1111-4111-8111-111111111111";

function item(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: "n-1",
    type: "rsvp_approved",
    seshId: SESH,
    seshTitle: "Porch sesh",
    actorHandle: "ryder",
    payload: {},
    readAt: null,
    createdAt: "2026-09-26T12:00:00Z",
    ...overrides,
  };
}

describe("describeNotification", () => {
  it.each([
    ["rsvp_requested", "@ryder asked to join Porch sesh."],
    ["rsvp_approved", "@ryder approved you for Porch sesh."],
    ["rsvp_denied", "The host of Porch sesh said no this time."],
    ["sesh_edited", "Porch sesh changed. Check the details."],
    ["sesh_cancelled", "Porch sesh was cancelled."],
    ["sesh_reminder", "Porch sesh starts soon."],
  ] as const)("says what a %s row is about, in words", (type, text) => {
    expect(describeNotification(item({ type })).text).toBe(text);
  });

  it("sends a sesh notification to its sesh", () => {
    expect(describeNotification(item({ type: "rsvp_requested" })).href).toBe(`/seshes/${SESH}`);
  });

  it("sends a denial to the feed, where the sesh is no longer shown to them", () => {
    expect(describeNotification(item({ type: "rsvp_denied" })).href).toBe("/seshes");
  });

  it("sends a card expiry to the card page", () => {
    const described = describeNotification(item({ type: "card_expiry", seshId: null, seshTitle: null, actorHandle: null }));
    expect(described).toEqual({ text: "Your card expires soon. Renew it to keep full access.", href: "/verify" });
  });

  it('calls a deleted actor "A member"', () => {
    expect(describeNotification(item({ actorHandle: null })).text).toBe("A member approved you for Porch sesh.");
  });

  it("falls back to a title kept in the payload when the sesh is out of sight", () => {
    const described = describeNotification(item({ type: "rsvp_denied", seshTitle: null, payload: { seshTitle: "Old porch" } }));
    expect(described.text).toBe("The host of Old porch said no this time.");
  });

  it('says "a sesh" when no title can be found', () => {
    expect(describeNotification(item({ type: "sesh_cancelled", seshTitle: null })).text).toBe("A sesh was cancelled.");
  });
});
