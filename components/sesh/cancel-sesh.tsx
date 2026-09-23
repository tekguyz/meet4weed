"use client";

import { useActionState, useState } from "react";
import { cancelSesh } from "@/app/(frame)/seshes/actions";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";

/** Cancelling locks the address for every guest at once and cannot be undone,
 *  so it asks first. It is a separate form from the edit form on purpose —
 *  it must never ride along with an ordinary save. */
export function CancelSesh({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(cancelSesh, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-danger underline"
      >
        Cancel this sesh
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <input type="hidden" name="id" value={id} readOnly />
      <p className="text-sm text-ink">
        Cancelling is final. Your guests keep seeing the sesh marked cancelled, and lose the address
        straight away. There is no way to bring it back — you would post a new one.
      </p>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button type="button" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </form>
  );
}
