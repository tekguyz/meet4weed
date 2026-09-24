import { describe, expect, it } from "vitest";
import { activeTab, frameHeader } from "@/components/frame/frame-paths";
import { APP_NAME } from "@/lib/env";

describe("activeTab", () => {
  it.each([
    ["/seshes", "seshes"],
    ["/seshes/abc", "seshes"],
    ["/seshes/abc/edit", "seshes"],
    ["/seshes/mine", "mine"],
    ["/seshes/new", "new"],
    ["/me", "me"],
    ["/me/settings", "me"],
    ["/", null],
    ["/verify", null],
    ["/messages", null],
    ["/m/ryder", null],
  ])("%s is %s", (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });
});

describe("frameHeader", () => {
  it.each([
    ["/", APP_NAME, null],
    ["/seshes", "Seshes", null],
    ["/seshes/mine", "My seshes", null],
    ["/seshes/new", "New sesh", null],
    ["/me", "Me", null],
    ["/seshes/abc", "Sesh", "/seshes"],
    ["/seshes/abc/edit", "Edit sesh", "/seshes/abc"],
    ["/verify", "Verify your card", "/"],
    ["/invite/held", "Invite saved", null],
    // Reached from a sesh or from Me, so there is no one parent to go up to,
    // and /m on its own is not a page. The tabs are the way out.
    ["/m/ryder", "Profile", null],
    ["/me/settings", "Settings", "/me"],
    ["/me/settings/profile", "Edit profile", "/me/settings"],
    ["/me/settings/handle", "Handle", "/me/settings"],
    ["/me/settings/theme", "Theme", "/me/settings"],
    ["/me/settings/avatar", "Avatar", "/me/settings"],
    ["/me/settings/password", "Password", "/me/settings"],
    ["/me/settings/sessions", "Sessions", "/me/settings"],
  ])("%s is titled %s with back %s", (path, title, back) => {
    expect(frameHeader(path)).toEqual({ title, back });
  });
});
