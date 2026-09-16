import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";
import { APP_NAME } from "@/lib/env";
import { getMyVerification, type MyVerification } from "@/lib/verification/status";

export default async function HomePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // A placeholder handle means the profile form was never completed.
  if (!profile.attestedAt || profile.handle.startsWith(RESERVED_HANDLE_PREFIX)) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl">{APP_NAME}</h1>
      <p className="text-sm text-ink-muted">
        Signed in as @{profile.handle}. Card status: {profile.status.replace("_", " ")}.
      </p>
      <VerificationSummary status={profile.status} latest={await getMyVerification()} />
      <ThemeToggle />
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="text-sm text-ink-muted underline">
          Sign out
        </button>
      </form>
    </main>
  );
}

function VerificationSummary({ status, latest }: { status: string; latest: MyVerification | null }) {
  if (status === "pending_review" || latest?.status === "pending_review") {
    return <p className="text-sm text-ink-muted">Your card is waiting for a person to check it.</p>;
  }
  const retry = latest?.status === "rejected" || latest?.status === "retake_requested";
  return (
    <div className="flex flex-col gap-2">
      {retry && latest?.decisionReason ? (
        <p role="status" className="text-sm text-danger">Your last submission was not approved: {latest.decisionReason}</p>
      ) : null}
      {latest?.status === "lapsed" ? (
        <p role="status" className="text-sm text-ink-muted">Nobody reviewed your last photos in time, so they were deleted. Please take them again.</p>
      ) : null}
      {status !== "verified" ? (
        <Link href="/verify" className="text-sm font-semibold text-primary underline">Verify your card</Link>
      ) : null}
    </div>
  );
}
