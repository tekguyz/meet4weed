import { NewPasswordForm } from "@/app/login/new-password/new-password-form";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Password" };

export default function PasswordPage() {
  return (
    <SettingsColumn intro="Other devices stay signed in. To sign them out, use Sessions.">
      <NewPasswordForm mode="change" />
    </SettingsColumn>
  );
}
