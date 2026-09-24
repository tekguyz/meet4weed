"use client";

import { useActionState, useState } from "react";
import { changeHandle } from "@/app/(frame)/me/settings/actions";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/forms/action-state";

/** Settings → Handle (issue #70). The rules are said before the member types,
 *  so a refusal is never the first they hear of them. */
export function ChangeHandleForm({ handle }: { handle: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(changeHandle, null);
  // Controlled, because React resets an uncontrolled form after its action
  // runs, and a refused handle must stay in the box to be fixed.
  const [value, setValue] = useState(handle);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Input
          label="Handle"
          name="handle"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="handle-help"
        />
        <p id="handle-help" className="text-xs text-ink-muted">
          3–20 characters. Letters, numbers and underscores. You can change it once every 30 days.
          The handle you give up stays locked for 30 days, so nobody can pose as you.
        </p>
        {state?.fieldErrors?.handle ? (
          <p role="alert" className="text-xs text-danger">
            {state.fieldErrors.handle}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Changing…" : "Change handle"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}
