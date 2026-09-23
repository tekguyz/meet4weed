import { SignOutEverywhere } from "@/components/member/sign-out-everywhere";
import { SignOutButton } from "@/components/member/sign-out-button";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Sessions" };

export default function SessionsPage() {
  return (
    <SettingsColumn>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">This device</h2>
        <SignOutButton />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Every device</h2>
        <p className="text-sm text-ink-muted">
          Lost a phone? This signs you out everywhere, this device included.
        </p>
        <SignOutEverywhere />
      </section>
    </SettingsColumn>
  );
}
