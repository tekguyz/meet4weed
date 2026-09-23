import { HeldRow, RowGroup, RowLink } from "@/components/ui/row-list";

/**
 * /me/settings (issue #65): a grouped list, one row per job. Handle, avatar
 * and delete account join it in their own tickets.
 */
export function SettingsList() {
  return (
    <div className="flex flex-col gap-6">
      <RowGroup label="Profile">
        <RowLink href="/me/settings/profile">Edit profile</RowLink>
      </RowGroup>
      <RowGroup label="Appearance">
        <RowLink href="/me/settings/theme">Theme</RowLink>
      </RowGroup>
      <RowGroup label="Account">
        <RowLink href="/me/settings/password">Password</RowLink>
        <RowLink href="/me/settings/sessions">Sessions</RowLink>
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
