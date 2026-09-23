import { daysBetween } from "@/lib/dates";
import type { MemberStatus } from "@/lib/profiles/schema";

/**
 * The read-only gate (spec §4.3), for screens. The database twin is
 * private.is_active_member(), which RLS policies use. Both treat a card as
 * valid through the whole of its expiry date, and neither trusts the daily
 * sweep to have run.
 */
export type MemberAccess = "full" | "read_only" | "pending" | "unverified" | "suspended";

type Card = { status: MemberStatus; cardExpiresOn: string | null };

export function memberAccess(profile: Card, today: string): MemberAccess {
  switch (profile.status) {
    case "suspended":
      return "suspended";
    case "pending_review":
      return "pending";
    case "unverified":
      return "unverified";
    case "expired":
      return "read_only";
    case "verified":
      return profile.cardExpiresOn !== null && profile.cardExpiresOn >= today ? "full" : "read_only";
  }
}

/** The Frame's tabs, in the order they always appear. */
export type FrameTab = "seshes" | "mine" | "new" | "me";

export type FrameAccess = {
  tabs: FrameTab[];
  /** Where `/` sends the member: the feed, or their where-you-stand card. */
  home: "/seshes" | "standing";
  /** The Admin row inside Me. Never a tab. */
  adminLink: boolean;
};

/**
 * The one place that decides what the Frame shows (issue #62). Screens render
 * its answer and decide nothing, the way the address panel renders
 * can_see_address(). Hidden tabs are hidden, not greyed: a member whose gate is
 * shut is not invited into an empty screen. RLS is still what refuses them.
 */
export function frameAccess(access: MemberAccess, isAdmin: boolean): FrameAccess {
  const canBrowse = access === "full" || access === "read_only";
  const tabs: FrameTab[] = canBrowse ? ["seshes", "mine"] : [];
  if (access === "full") tabs.push("new");
  tabs.push("me");
  return { tabs, home: canBrowse ? "/seshes" : "standing", adminLink: isAdmin };
}

export const EXPIRY_BANNER_DAYS = 30;

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function expiryBanner(profile: Card, today: string): string | null {
  if (memberAccess(profile, today) !== "full" || !profile.cardExpiresOn) return null;
  const days = daysBetween(today, profile.cardExpiresOn);
  if (days > EXPIRY_BANNER_DAYS) return null;
  if (days === 0) return "Your card expires today. Renew it to keep full access.";
  const date = SHORT_DATE.format(new Date(`${profile.cardExpiresOn}T00:00:00Z`));
  return `Your card expires ${date}, in ${days} day${days === 1 ? "" : "s"}. Renew it to keep full access.`;
}
