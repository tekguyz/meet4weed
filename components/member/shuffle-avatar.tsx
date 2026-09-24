"use client";

import { useActionState } from "react";
import { shuffleAvatar } from "@/app/(frame)/me/settings/actions";
import { Avatar } from "@/components/member/avatar";
import { ActionResult } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";

type Props = {
  seed: string | null;
  memberId: string;
  handle: string;
  displayName: string | null;
};

/**
 * Settings → Avatar (issue #69). The action revalidates the layout, so the
 * new seed comes back as a prop and every avatar on screen redraws at once.
 */
export function ShuffleAvatar({ seed, memberId, handle, displayName }: Props) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(shuffleAvatar, null);

  return (
    <form action={action} className="flex flex-col items-center gap-6">
      <Avatar seed={seed} memberId={memberId} handle={handle} displayName={displayName} className="size-32" />
      {/* Null is left out: the action reads a missing seed as the member id. */}
      {seed ? <input type="hidden" name="currentSeed" value={seed} /> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Shuffling…" : "Shuffle"}
      </Button>
      <div className="w-full">
        <ActionResult state={state} />
      </div>
    </form>
  );
}
