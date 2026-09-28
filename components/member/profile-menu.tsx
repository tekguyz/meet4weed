"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { blockMember } from "@/app/(frame)/m/block-actions";
import { Banner } from "@/components/ui/banner";
import { Button, buttonClass } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * The quiet "…" on another member's profile (issue #111). Today it holds one
 * thing, Block; Report joins it in the next step of Plan 06.
 *
 * A disclosure, not an ARIA menu: a button that shows a short list of
 * buttons. An ARIA menu promises arrow-key roving that one item does not need.
 *
 * Safety voice (PRODUCT.md): plain and calm, no joke, no alarm. The confirm
 * step says what a block does and that the other member is not told, and
 * nothing more.
 */
export function ProfileMenu({ memberId, handle }: { memberId: string; handle: string }) {
  const [step, setStep] = useState<"closed" | "menu" | "confirm">("closed");
  const [state, action, pending] = useActionState<ActionState | null, FormData>(blockMember, null);
  const menuId = useId();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (step === "menu") firstItem.current?.focus();
    if (step === "confirm") panel.current?.focus();
    // The trigger is hidden during the confirm step, so focus goes back to it
    // only once it has rendered again.
    if (step === "closed" && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [step]);

  // A tap anywhere outside the open list closes it.
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "menu") return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setStep("closed");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [step]);

  // A done block moves focus to the result, so a screen reader reads its
  // heading. Focus, not a status role: that belongs to the shared Banner.
  const done = state?.ok === true;
  useEffect(() => {
    if (done) panel.current?.focus();
  }, [done]);

  function close() {
    restoreFocus.current = true;
    setStep("closed");
  }

  // Tabbing out of the open list closes it, as a tap outside does.
  function onBlur(event: React.FocusEvent) {
    if (step === "menu" && !wrapper.current?.contains(event.relatedTarget as Node | null)) setStep("closed");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && step !== "closed" && !pending && !done) {
      event.stopPropagation();
      close();
    }
  }

  if (done) {
    return (
      <section
        ref={panel}
        tabIndex={-1}
        aria-labelledby={titleId}
        data-blocked=""
        className="flex flex-col gap-4 rounded-card bg-surface p-4 outline-none"
      >
        {/* The profile is hidden now, so the tab stops naming it. React hoists this. */}
        <title>Blocked</title>
        <div className="flex flex-col gap-2">
          <h1 id={titleId} className="text-lg break-words text-balance">
            @{handle} is blocked
          </h1>
          <p className="text-sm text-ink-muted">You won’t see each other’s profiles or seshes anymore.</p>
        </div>
        <Link href="/" className={`${buttonClass()} ${FOCUS_RING}`}>
          Back to seshes
        </Link>
      </section>
    );
  }

  return (
    <div onKeyDown={onKeyDown} className="contents">
      <div ref={wrapper} onBlur={onBlur} className="absolute top-2.5 -right-2" hidden={step === "confirm"}>
        <button
          ref={trigger}
          type="button"
          aria-label={`More options for @${handle}`}
          aria-expanded={step === "menu"}
          aria-controls={step === "menu" ? menuId : undefined}
          onClick={() => setStep(step === "menu" ? "closed" : "menu")}
          className={`inline-flex size-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${FOCUS_RING}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
          </svg>
        </button>

        {step === "menu" ? (
          <ul id={menuId} className="absolute top-12 right-0 z-10 min-w-40 rounded-card bg-surface-2 p-1.5">
            <li>
              <button
                ref={firstItem}
                type="button"
                onClick={() => setStep("confirm")}
                className={`flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm text-ink transition-colors hover:bg-rule ${FOCUS_RING}`}
              >
                Block
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      {step === "confirm" ? (
        <section
          ref={panel}
          tabIndex={-1}
          aria-labelledby={titleId}
          className="flex flex-col gap-4 rounded-card bg-surface p-4 outline-none"
        >
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="text-lg break-words text-balance">
              Block @{handle}?
            </h2>
            <p className="text-sm text-ink-muted">
              You won’t see each other’s profiles or seshes, and neither of you can join the other’s. If
              either of you has a spot at the other’s upcoming sesh, that spot is cancelled.
            </p>
            <p className="text-sm text-ink-muted">They won’t be told.</p>
          </div>
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="memberId" value={memberId} />
            {/* DESIGN.md gives destructive actions Clay; Sage would read as "go ahead". */}
            <Button type="submit" variant="danger" disabled={pending} className={FOCUS_RING}>
              {pending ? "Blocking…" : "Block"}
            </Button>
            <Button type="button" variant="quiet" onClick={close} disabled={pending} className={FOCUS_RING}>
              Cancel
            </Button>
          </form>
          {state && !state.ok ? (
            <Banner tone="danger" nested urgent>
              {state.message}
            </Banner>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
