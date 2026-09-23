import { redirect } from "next/navigation";
import { EditProfileForm } from "@/components/member/edit-profile-form";
import { getMyProfile } from "@/lib/profiles/queries";
import { SettingsPage } from "../settings-page";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsPage intro="This is what other members see.">
      <EditProfileForm profile={profile} />
    </SettingsPage>
  );
}
