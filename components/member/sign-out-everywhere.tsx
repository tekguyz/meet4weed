"use client";

import { useActionState } from "react";
import { signOutEverywhere } from "@/app/(frame)/me/settings/actions";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";

/** Success leaves for /login, so the banner only ever carries a failure. */
export function SignOutEverywhere() {
  const [state, action, pending] = useActionState<ActionState | null>(signOutEverywhere, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Signing out…" : "Sign out everywhere"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}
