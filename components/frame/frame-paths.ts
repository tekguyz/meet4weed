import { APP_NAME } from "@/lib/env";
import type { FrameTab } from "@/lib/member/gate";

export const TABS: Record<FrameTab, { href: string; label: string }> = {
  seshes: { href: "/seshes", label: "Seshes" },
  mine: { href: "/seshes/mine", label: "My seshes" },
  new: { href: "/seshes/new", label: "New" },
  me: { href: "/me", label: "Me" },
};

const TAB_ROOTS = new Set(["/", ...Object.values(TABS).map((tab) => tab.href)]);

/** Which tab a path belongs to. A sesh opened from anywhere counts as Seshes. */
export function activeTab(pathname: string): FrameTab | null {
  if (pathname === "/me" || pathname.startsWith("/me/")) return "me";
  if (pathname === "/seshes/mine") return "mine";
  if (pathname === "/seshes/new") return "new";
  if (pathname === "/seshes" || pathname.startsWith("/seshes/")) return "seshes";
  return null;
}

const PROFILE_PATH = /^\/m\/[^/]+$/;

const TITLES: [RegExp, string][] = [
  [/^\/seshes$/, "Seshes"],
  [/^\/seshes\/mine$/, "My seshes"],
  [/^\/seshes\/new$/, "New sesh"],
  [/^\/seshes\/[^/]+$/, "Sesh"],
  [/^\/seshes\/[^/]+\/edit$/, "Edit sesh"],
  [/^\/me$/, "Me"],
  [/^\/me\/settings$/, "Settings"],
  [/^\/me\/settings\/profile$/, "Edit profile"],
  [/^\/me\/settings\/handle$/, "Handle"],
  [/^\/me\/settings\/theme$/, "Theme"],
  [/^\/me\/settings\/avatar$/, "Avatar"],
  [/^\/me\/settings\/password$/, "Password"],
  [/^\/me\/settings\/sessions$/, "Sessions"],
  [/^\/me\/settings\/delete$/, "Delete account"],
  [/^\/verify$/, "Verify your card"],
  [/^\/invite\/held$/, "Invite saved"],
  [PROFILE_PATH, "Profile"],
];

/** Pages reached from outside the tabs, whose parent path is not a page. A
 *  profile is reached from a sesh or from Me, and `/m` alone is nothing. */
const NO_BACK = new Set(["/invite/held"]);

/** The phone header's title, and where its back arrow goes. A tab has no back
 *  arrow; anything under one goes up a level, so no page is a dead end. */
export function frameHeader(pathname: string): { title: string; back: string | null } {
  const title = TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? APP_NAME;
  if (TAB_ROOTS.has(pathname) || NO_BACK.has(pathname) || PROFILE_PATH.test(pathname)) {
    return { title, back: null };
  }
  return { title, back: pathname.slice(0, pathname.lastIndexOf("/")) || "/" };
}
