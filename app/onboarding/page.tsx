import { redirect } from "next/navigation";
import { AttestationForm } from "@/components/onboarding/attestation-form";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { getMyProfile } from "@/lib/profiles/queries";
import { RESERVED_HANDLE_PREFIX } from "@/lib/profiles/schema";
import { APP_NAME } from "@/lib/env";

export default async function OnboardingPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // Already through both steps. Without this, a back button or a stale link
  // drops a finished member back into the setup form.
  const finished = profile.attestedAt && !profile.handle.startsWith(RESERVED_HANDLE_PREFIX);
  if (finished) redirect("/");

  const step = profile.attestedAt ? 2 : 1;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Step {step} of 2
        </p>
        <h1 className="text-3xl">{step === 1 ? `Welcome to ${APP_NAME}` : "Set up your profile"}</h1>
        <p className="text-sm text-ink-muted">
          {step === 1
            ? "Four quick claims. Every one has to be true."
            : "This is what other members see. You can change it any time."}
        </p>
      </header>

      {step === 1 ? <AttestationForm /> : <ProfileForm profile={profile} />}
    </main>
  );
}
