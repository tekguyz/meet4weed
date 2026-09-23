"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(frame)/me/settings/actions";
import { ProfileFields } from "@/components/onboarding/profile-form";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";
import type { Profile } from "@/lib/profiles/schema";

/** Settings → Edit profile (issue #65). The submit sits right after the last
 *  field, and the shared banner under it says whether it saved. */
export function EditProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(updateProfile, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <ProfileFields profile={profile} errors={state?.fieldErrors} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}
