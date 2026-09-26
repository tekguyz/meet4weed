import { PushSetting } from "@/components/notify/push-setting";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Notifications" };

/** Turning push on or off (#56), for this device only, like the theme. */
export default function NotificationsSettingsPage() {
  return (
    <SettingsColumn intro="For this phone only; your other devices keep their own setting. The lock screen only ever says “You have an update” — never who, never which sesh. The bell always has everything.">
      <PushSetting />
    </SettingsColumn>
  );
}
