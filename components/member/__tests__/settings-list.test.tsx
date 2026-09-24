import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsList } from "@/components/member/settings-list";

describe("SettingsList (issue #65)", () => {
  it("opens one page per job", () => {
    render(<SettingsList />);

    for (const [name, href] of [
      ["Edit profile", "/me/settings/profile"],
      ["Theme", "/me/settings/theme"],
      ["Avatar", "/me/settings/avatar"],
      ["Password", "/me/settings/password"],
      ["Sessions", "/me/settings/sessions"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("holds places for notifications and blocked members that say they are coming", () => {
    render(<SettingsList />);

    for (const name of ["Notifications", "Blocked members"]) {
      const row = screen.getByText(name).closest("li") as HTMLElement;
      expect(row).toHaveTextContent(/coming soon/i);
      // A held row does not open a page.
      expect(row.querySelector("a")).toBeNull();
    }
  });
});
