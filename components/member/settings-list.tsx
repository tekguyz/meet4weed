import { RowGroup, RowLink } from "@/components/ui/row-list";

/**
 * /me/settings (issue #65): a grouped list, one row per job. Delete
 * account (issue #71) sits last under Account. Blocked members (issue
 * #112) sits under Safety.
 */
export function SettingsList() {
  return (
    <div className="flex flex-col gap-6">
      <RowGroup label="Profile">
        <RowLink href="/me/settings/profile">Edit profile</RowLink>
        <RowLink href="/me/settings/handle">Handle</RowLink>
        <RowLink href="/me/settings/avatar">Avatar</RowLink>
      </RowGroup>
      {/* Both are saved per device, not per account. */}
      <RowGroup label="This device">
        <RowLink href="/me/settings/theme">Theme</RowLink>
        <RowLink href="/me/settings/notifications">Notifications</RowLink>
      </RowGroup>
      <RowGroup label="Safety">
        <RowLink href="/me/settings/blocked">Blocked members</RowLink>
      </RowGroup>
      <RowGroup label="Account">
        <RowLink href="/me/settings/password">Password</RowLink>
        <RowLink href="/me/settings/sessions">Sessions</RowLink>
        <RowLink href="/me/settings/delete">Delete account</RowLink>
      </RowGroup>
    </div>
  );
}
