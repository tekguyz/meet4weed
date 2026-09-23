import { SettingsList } from "@/components/member/settings-list";
import { SettingsPage } from "./settings-page";

export const metadata = { title: "Settings" };

export default function SettingsIndexPage() {
  return (
    <SettingsPage>
      <SettingsList />
    </SettingsPage>
  );
}
