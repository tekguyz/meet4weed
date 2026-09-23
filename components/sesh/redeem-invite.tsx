"use client";

import { useActionState } from "react";
import { redeemInvite } from "@/app/(frame)/seshes/invite-actions";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * The button that spends the use.
 *
 * A SIGNED-IN HUMAN PRESSING THIS IS THE ONLY THING IN THE APP THAT SPENDS
 * ONE. The page around it renders on a GET and burns nothing, so a chat app
 * drawing a preview card cannot eat the link before its recipient sees it.
 *
 * There is nothing here for the success case, on purpose. The action
 * redirects, the way app/auth/actions/email-link.ts does. Navigating from
 * here instead left the successful redeemer reading "that link does not
 * work" — the action's reply re-rendered this page, and by then the link
 * they had just spent was no longer live. The only state this renders is a
 * failure, and every failure is the same sentence.
 */
export function RedeemInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(redeemInvite, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="token" value={token} readOnly />
      <Button type="submit" disabled={pending}>
        {pending ? "Opening…" : "Use this invite"}
      </Button>
      {state && !state.ok ? (
        <Banner tone="danger">{state.message}</Banner>
      ) : null}
    </form>
  );
}
