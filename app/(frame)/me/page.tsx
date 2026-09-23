import Link from "next/link";
import { redirect } from "next/navigation";
import { profilePath } from "@/components/member/handle-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { FOCUS_RING } from "@/components/ui/focus";
import { amIAdmin } from "@/lib/admin/queries";
import { floridaToday } from "@/lib/dates";
import { frameAccess, memberAccess } from "@/lib/member/gate";
import { getMyProfile } from "@/lib/profiles/queries";

export const metadata = { title: "Me" };

/**
 * A stand-in for Me, so the Me tab goes somewhere and nothing the home page
 * held is lost when it stops holding it: the theme toggle, sign out, and the
 * admin link. The real page, with settings, is issue #65.
 */
export default async function MePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const { adminLink } = frameAccess(memberAccess(profile, floridaToday()), await amIAdmin());

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-3xl">@{profile.handle}</h1>
        {profile.displayName ? <p className="truncate text-sm text-ink-muted">{profile.displayName}</p> : null}
      </header>

      <Link
        href={profilePath(profile.handle)}
        className={`flex min-h-11 items-center rounded-card bg-surface px-4 text-sm text-ink ${FOCUS_RING}`}
      >
        See your profile as others see it
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl">Theme</h2>
        <ThemeToggle />
      </section>

      {adminLink ? (
        <Link href="/admin" className={`flex min-h-11 items-center rounded-card bg-surface px-4 text-sm text-ink ${FOCUS_RING}`}>
          Admin
        </Link>
      ) : null}

      <form action="/auth/sign-out" method="post">
        <button type="submit" className={`min-h-11 text-sm text-ink-muted underline ${FOCUS_RING}`}>
          Sign out
        </button>
      </form>
    </div>
  );
}
