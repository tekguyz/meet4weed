import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsList } from "@/components/member/settings-list";

describe("SettingsList (issue #65)", () => {
  // #56: push is per device, like the theme, so the two sit together.
  it("puts Notifications next to Theme, under This device", () => {
    render(<SettingsList />);
    const group = screen.getByRole("heading", { name: "This device" }).closest("section") as HTMLElement;
    expect(group).toHaveTextContent(/Theme.*Notifications/);
  });

  it("opens one page per job", () => {
    render(<SettingsList />);

    for (const [name, href] of [
      ["Edit profile", "/me/settings/profile"],
      ["Handle", "/me/settings/handle"],
      ["Theme", "/me/settings/theme"],
      ["Avatar", "/me/settings/avatar"],
      ["Notifications", "/me/settings/notifications"],
      ["Password", "/me/settings/password"],
      ["Sessions", "/me/settings/sessions"],
      ["Delete account", "/me/settings/delete"],
      ["Blocked members", "/me/settings/blocked"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

});
