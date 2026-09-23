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
  ])("%s is titled %s with back %s", (path, title, back) => {
    expect(frameHeader(path)).toEqual({ title, back });
  });
});
