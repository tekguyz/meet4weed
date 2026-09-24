import { redirect } from "next/navigation";
import { ChangeHandleForm } from "@/components/member/change-handle-form";
import { getMyProfile } from "@/lib/profiles/queries";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Handle" };

/** Issue #70. The rules live in public.change_handle(). */
export default async function HandlePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsColumn intro="Your handle is how members find you, and it is in your profile link.">
      <ChangeHandleForm handle={profile.handle} />
    </SettingsColumn>
  );
}
