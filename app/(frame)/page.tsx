import { redirect } from "next/navigation";
import { WhereYouStand } from "@/components/member/where-you-stand";
import { amIAdmin } from "@/lib/admin/queries";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { standing } from "@/lib/member/standing";
import { getMyProfile } from "@/lib/profiles/queries";
import { getMyVerification } from "@/lib/verification/status";

/** `/` decides nothing: frameAccess() says whether this member browses. If
 *  they do, the app opens on Seshes. If not, they see where they stand. */
export default async function HomePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const today = floridaToday();
  if (frameAccess(memberAccess(profile, today), await amIAdmin()).home === "/seshes") {
    redirect("/seshes");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl">Your card</h1>
      <WhereYouStand standing={standing(profile, await getMyVerification(), today)} />
    </div>
  );
}
