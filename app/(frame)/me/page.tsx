import { redirect } from "next/navigation";
import { MeView } from "@/components/member/me-view";
import { amIAdmin } from "@/lib/admin/queries";
import { appVersion } from "@/lib/app-version";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { standing } from "@/lib/member/standing";
import { getMyProfile } from "@/lib/profiles/queries";
import { getMyVerification } from "@/lib/verification/status";

export const metadata = { title: "Me" };

export default async function MePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const today = floridaToday();
  const [isAdmin, latest] = await Promise.all([amIAdmin(), getMyVerification()]);
  const { adminLink } = frameAccess(memberAccess(profile, today), isAdmin);

  return (
    <MeView
      memberId={profile.id}
      avatarSeed={profile.avatarSeed}
      handle={profile.handle}
      displayName={profile.displayName}
      standing={standing(profile, latest, today)}
      adminLink={adminLink}
      version={appVersion()}
    />
  );
}
