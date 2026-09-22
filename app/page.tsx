import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { amIAdmin } from "@/lib/admin/queries";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";
import { floridaToday } from "@/lib/dates";
import { APP_NAME } from "@/lib/env";
import { expiryBanner, memberAccess, type MemberAccess } from "@/lib/member/gate";
import type { Profile } from "@/lib/profiles/schema";
import { getMyVerification, type MyVerification } from "@/lib/verification/status";

export default async function HomePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // A placeholder handle means the profile form was never completed.
  if (!profile.attestedAt || profile.handle.startsWith(RESERVED_HANDLE_PREFIX)) {
    redirect("/onboarding");
  }

  const today = floridaToday();
  const access = memberAccess(profile, today);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl">{APP_NAME}</h1>
      <p className="text-sm text-ink-muted">
        Signed in as @{profile.handle}. Card status: {profile.status.replace("_", " ")}.
      </p>
      <HomeNav access={access} isAdmin={await amIAdmin()} />
      <AccessNotice profile={profile} today={today} />
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

/** The way into the app. Without this the home page is a dead end: every sesh
 *  screen exists but nothing links to one, so the app reads as unbuilt.
 *  The sesh links are hidden until the card gate opens, because RLS returns
 *  nothing to a member who is not active and an empty screen reads as broken. */
function HomeNav({ access, isAdmin }: { access: MemberAccess; isAdmin: boolean }) {
  const canBrowse = access === "full" || access === "read_only";
  if (!canBrowse && !isAdmin) return null;

  return (
    <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm text-ink-muted">
      {canBrowse ? (
        <>
          <Link href="/seshes" className="underline">Seshes</Link>
          <Link href="/seshes/mine" className="underline">My seshes</Link>
        </>
      ) : null}
      {access === "full" ? (
        <Link href="/seshes/new" className="underline">New sesh</Link>
      ) : null}
      {isAdmin ? (
        <Link href="/admin/verifications" className="underline">Verification queue</Link>
      ) : null}
    </nav>
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

function AccessNotice({ profile, today }: { profile: Profile; today: string }) {
  const banner = expiryBanner(profile, today);
  if (banner) {
    return (
      <p role="status" className="rounded-card bg-surface p-4 text-sm text-secondary">
        {banner} <Link href="/verify" className="underline">Renew</Link>
      </p>
    );
  }
  if (memberAccess(profile, today) === "read_only") {
    return (
      <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink">
        Your card has expired, so your account is read-only. You can browse and see your history.{" "}
        <Link href="/verify" className="underline">Add your renewed card</Link> to get full access back.
      </p>
    );
  }
  return null;
}
