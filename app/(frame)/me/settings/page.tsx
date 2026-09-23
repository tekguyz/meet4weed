import { SettingsList } from "@/components/member/settings-list";
import { SettingsColumn } from "./settings-column";

export const metadata = { title: "Settings" };

export default function SettingsIndexPage() {
  return (
    <SettingsColumn>
      <SettingsList />
    </SettingsColumn>
  );
}
