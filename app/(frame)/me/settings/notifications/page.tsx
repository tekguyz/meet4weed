import { redirect } from "next/navigation";
import { NotInDemo } from "@/components/demo/not-in-demo";
import { PushSetting } from "@/components/notify/push-setting";
import { getMyProfile } from "@/lib/profiles/queries";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Notifications" };

/** Turning push on or off (#56), for this device only, like the theme. */
export default async function NotificationsSettingsPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsColumn intro="For this phone only; your other devices keep their own setting. The lock screen only ever says “You have an update” — never who, never which sesh. The bell always has everything.">
      {/* No push service ever holds a demo endpoint (#39). */}
      {profile.isDemo ? <NotInDemo /> : <PushSetting />}
    </SettingsColumn>
  );
}
