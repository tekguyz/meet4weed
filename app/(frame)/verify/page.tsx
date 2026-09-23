import { redirect } from "next/navigation";
import { VerifyFlow } from "@/components/verify/verify-flow";
import { floridaToday } from "@/lib/dates";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";
import { getMyVerification } from "@/lib/verification/status";

export const metadata = { title: "Verify your card" };

export default async function VerifyPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  if (!profile.attestedAt || profile.handle.startsWith(RESERVED_HANDLE_PREFIX)) redirect("/onboarding");

  const latest = await getMyVerification();
  const waiting = profile.status === "pending_review" || latest?.status === "pending_review";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl">Verify your card</h1>
      {profile.status === "suspended" ? (
        <p className="text-sm text-danger">This account is suspended.</p>
      ) : waiting ? (
        <p className="text-sm text-ink-muted">
          Your card is waiting for a person to check it. Your photos are deleted as soon as they decide.
        </p>
      ) : (
        <VerifyFlow today={floridaToday()} />
      )}
    </div>
  );
}
