import { DeleteAccountForm } from "@/components/member/delete-account-form";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Delete account" };

/** Issue #71. The work is in lib/account/delete.ts. */
export default function DeleteAccountPage() {
  return (
    <SettingsColumn intro="This deletes your account now. It cannot be undone.">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">What goes</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
          <li>Seshes you host that have not started are cancelled.</li>
          <li>Your profile, your RSVPs and your bring-list items are deleted.</li>
          <li>Your card and face photos are deleted.</li>
        </ul>
        <p className="text-sm text-ink-muted">
          You can sign up again later with the same email. You will need to verify your card again.
        </p>
      </section>
      <DeleteAccountForm />
    </SettingsColumn>
  );
}
