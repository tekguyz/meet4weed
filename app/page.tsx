import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";
import { APP_NAME } from "@/lib/env";

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
      <p className="text-sm text-ink-muted">
        Card verification lands in the next plan. Nothing else is unlocked yet.
      </p>
      <ThemeToggle />
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="text-sm text-ink-muted underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
