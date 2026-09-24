import { redirect } from "next/navigation";
import { ShuffleAvatar } from "@/components/member/shuffle-avatar";
import { getMyProfile } from "@/lib/profiles/queries";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Avatar" };

/** Issue #69. A generated mark, never a photo. */
export default async function AvatarPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsColumn intro="Your avatar is drawn for you. Shuffle until you like it.">
      <ShuffleAvatar
        seed={profile.avatarSeed}
        memberId={profile.id}
        handle={profile.handle}
        displayName={profile.displayName}
      />
    </SettingsColumn>
  );
}
