import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsPage } from "../settings-page";

export const metadata = { title: "Theme" };

/** The toggle's home for good (issue #65). It saves to this device only, and
 *  the page changes colour the moment it is pressed. */
export default function ThemePage() {
  return (
    <SettingsPage intro="Saved on this device. System follows your phone's setting.">
      <ThemeToggle />
    </SettingsPage>
  );
}
