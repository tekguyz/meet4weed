"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { unblockMember } from "@/app/(frame)/m/block-actions";
import { Avatar } from "@/components/member/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus";
import { floridaShortDate } from "@/lib/dates";
import type { ActionState } from "@/lib/forms/action-state";
import type { BlockedMember } from "@/lib/member/blocks";

/**
 * Me -> Blocked (issue #112): the members the caller has blocked, newest
 * first, each with Unblock.
 *
 * No row links to a profile: the wall hides it, and the link would be a 404.
 *
 * Safety voice (PRODUCT.md): plain and calm, no joke. Unblock asks once, and
 * says the one thing a member might not expect — old spots stay as they are.
 */
export function BlockedList({ blocks }: { blocks: BlockedMember[] }) {
  if (blocks.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
        <h2 className="text-lg">You haven’t blocked anyone</h2>
        <p className="text-sm text-ink-muted">
          If someone ever makes you feel unsafe, open their profile and tap ••• to block them. They won’t be
          told.
        </p>
      </section>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-rule overflow-hidden rounded-card bg-surface">
      {blocks.map((block) => (
        <BlockedRow key={block.memberId} block={block} />
      ))}
    </ul>
  );
}

function BlockedRow({ block }: { block: BlockedMember }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ActionState | null, FormData>(unblockMember, null);
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [confirming]);

  function cancel() {
    restoreFocus.current = true;
    setConfirming(false);
  }

  return (
    <li
      className="flex flex-col gap-3 px-4 py-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && confirming && !pending) {
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          seed={block.avatarSeed}
          memberId={block.memberId}
          handle={block.handle}
          displayName={block.displayName}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span id={titleId} className="truncate text-sm font-semibold text-ink">
            @{block.handle}
          </span>
          <span className="truncate text-xs text-ink-muted">
            {block.displayName ? `${block.displayName} · ` : ""}Blocked{" "}
            {floridaShortDate(new Date(block.blockedAt))}
          </span>
        </div>
        {confirming ? null : (
          <button
            ref={trigger}
            type="button"
            aria-label={`Unblock @${block.handle}`}
            onClick={() => setConfirming(true)}
            className={`min-h-11 shrink-0 rounded-control bg-surface-2 px-4 text-sm font-semibold text-ink transition-colors hover:bg-rule ${FOCUS_RING}`}
          >
            Unblock
          </button>
        )}
      </div>

      {confirming ? (
        <form action={action} aria-labelledby={titleId} className="flex flex-col gap-3">
          <input type="hidden" name="memberId" value={block.memberId} />
          <p className="text-sm text-ink-muted">
            You’ll see each other’s profiles and seshes again. Any spot that ended with the block stays ended.
          </p>
          <div className="flex gap-3">
            <Button ref={confirmButton} type="submit" disabled={pending} className={FOCUS_RING}>
              {pending ? "Unblocking…" : "Unblock"}
            </Button>
            <Button type="button" variant="quiet" onClick={cancel} disabled={pending} className={FOCUS_RING}>
              Cancel
            </Button>
          </div>
          {state && !state.ok ? (
            <Banner tone="danger" nested urgent>
              {state.message}
            </Banner>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
