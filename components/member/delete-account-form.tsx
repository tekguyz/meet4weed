"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/(frame)/me/settings/actions";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import type { ActionState } from "@/lib/forms/action-state";

/** Settings → Delete account (issue #71). Success leaves for /login, so the
 *  banner only ever carries a failure. */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(deleteAccount, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <PasswordInput
          label="Your password"
          name="password"
          autoComplete="current-password"
          required
          aria-describedby="delete-password-help"
        />
        <p id="delete-password-help" className="text-xs text-ink-muted">
          So nobody holding your unlocked phone can do this.
        </p>
        {state?.fieldErrors?.password ? (
          <p role="alert" className="text-xs text-danger">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}
