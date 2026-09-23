import { NewPasswordForm } from "@/app/login/new-password/new-password-form";
import { SettingsPage } from "../settings-page";

export const metadata = { title: "Password" };

export default function PasswordPage() {
  return (
    <SettingsPage intro="Other devices stay signed in. To sign them out, use Sessions.">
      <NewPasswordForm mode="change" />
    </SettingsPage>
  );
}
