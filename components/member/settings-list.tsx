import { HeldRow, RowGroup, RowLink } from "@/components/ui/row-list";

/**
 * /me/settings (issue #65): a grouped list, one row per job. Delete
 * account (issue #71) sits last under Account.
 */
export function SettingsList() {
  return (
    <div className="flex flex-col gap-6">
      <RowGroup label="Profile">
        <RowLink href="/me/settings/profile">Edit profile</RowLink>
        <RowLink href="/me/settings/handle">Handle</RowLink>
      </RowGroup>
      <RowGroup label="Appearance">
        <RowLink href="/me/settings/theme">Theme</RowLink>
        <RowLink href="/me/settings/avatar">Avatar</RowLink>
      </RowGroup>
      <RowGroup label="Account">
        <RowLink href="/me/settings/password">Password</RowLink>
        <RowLink href="/me/settings/sessions">Sessions</RowLink>
        <RowLink href="/me/settings/delete">Delete account</RowLink>
      </RowGroup>
      <RowGroup label="Coming soon">
        {/* Plan 05 fills this in. */}
        <HeldRow>Notifications</HeldRow>
        {/* Plan 06 fills this in. */}
        <HeldRow>Blocked members</HeldRow>
      </RowGroup>
    </div>
  );
}
