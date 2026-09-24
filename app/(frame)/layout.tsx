import { redirect } from "next/navigation";
import { Frame } from "@/components/frame/frame";
import { amIAdmin } from "@/lib/admin/queries";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";

/**
 * Every signed-in page sits inside the Frame (issue #62). Onboarding, the admin
 * area, sign-in and the invite page do not: the first two have their own way
 * through, and the last two are read signed out.
 *
 * A layout does not re-run on every navigation, so each page still checks the
 * member for itself. This check is what keeps the Frame from ever drawing tabs
 * for somebody who has not finished onboarding.
 */
export default async function FrameLayout({ children }: { children: React.ReactNode }) {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // A placeholder handle means the profile form was never completed.
  if (!profile.attestedAt || profile.handle.startsWith(RESERVED_HANDLE_PREFIX)) {
    redirect("/onboarding");
  }

  const { tabs } = frameAccess(memberAccess(profile, floridaToday()), await amIAdmin());
  return (
    <Frame
      tabs={tabs}
      avatar={{
        seed: profile.avatarSeed,
        memberId: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
      }}
    >
      {children}
    </Frame>
  );
}
