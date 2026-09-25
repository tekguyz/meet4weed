"use client";

import { useActionState } from "react";
import { askToJoin, decideRsvp, withdrawRsvp } from "@/app/(frame)/seshes/rsvp-actions";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";
import { FOCUS_RING } from "@/components/ui/focus";

export function AskToJoin({ seshId }: { seshId: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(askToJoin, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="seshId" value={seshId} readOnly />
      <Button type="submit" disabled={pending || state?.ok}>
        {pending ? "Asking…" : state?.ok ? "Asked" : "Ask to join"}
      </Button>
      <ActionResult state={state} />
      <p className="text-sm text-ink-muted">
        The host decides. The address only appears if they say yes.
      </p>
    </form>
  );
}

export function WithdrawRsvp({ seshId, approved }: { seshId: string; approved: boolean }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(withdrawRsvp, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="seshId" value={seshId} readOnly />
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Withdrawing…" : approved ? "Give up my spot" : "Withdraw my request"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}

export function DecideButtons({
  rsvpId,
  seshId,
  approved,
}: {
  rsvpId: string;
  seshId: string;
  approved: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(decideRsvp, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="rsvpId" value={rsvpId} readOnly />
      <input type="hidden" name="seshId" value={seshId} readOnly />
      <div className="flex gap-2">
        {approved ? (
          <button
            type="submit"
            name="decision"
            value="kicked"
            disabled={pending}
            className={`min-h-11 rounded-control bg-surface-2 px-3 py-2 text-sm text-danger disabled:opacity-50 ${FOCUS_RING}`}
          >
            Remove
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="decision"
              value="approved"
              disabled={pending}
              className={`min-h-11 rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50 ${FOCUS_RING}`}
            >
              Approve
            </button>
            <button
              type="submit"
              name="decision"
              value="denied"
              disabled={pending}
              className={`min-h-11 rounded-control bg-surface-2 px-3 py-2 text-sm text-ink disabled:opacity-50 ${FOCUS_RING}`}
            >
              Decline
            </button>
          </>
        )}
      </div>
      {/* The host's queue row is already a card. */}
      <ActionResult state={state} nested />
    </form>
  );
}
