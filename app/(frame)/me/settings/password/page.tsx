import { redirect } from "next/navigation";
import { NotInDemo } from "@/components/demo/not-in-demo";
import { NewPasswordForm } from "@/app/login/new-password/new-password-form";
import { getMyProfile } from "@/lib/profiles/queries";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Password" };

export default async function PasswordPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsColumn intro="Other devices stay signed in. To sign them out, use Sessions.">
      {/* A visitor has no password to change (#39). */}
      {profile.isDemo ? <NotInDemo /> : <NewPasswordForm mode="change" />}
    </SettingsColumn>
  );
}
