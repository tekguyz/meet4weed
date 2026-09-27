"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { enterDemo } from "@/app/demo-actions";
import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { FOCUS_RING, TAP_TEXT } from "@/components/ui/focus";

/**
 * The demo door (issue #39). A form button, never a link: only a press may
 * create a visitor, so a link preview, a prefetch or a crawler creates none.
 *
 * `button` sits under Sign up on the landing page. `text` is the small
 * "Just looking?" line on /login, for somebody who arrived at a form they
 * cannot use.
 */
export function DemoButton({ look = "button" }: { look?: "button" | "text" }) {
  const [state, action] = useActionState(enterDemo, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <Submit look={look} />
      {state && !state.ok ? <Banner tone="warning">{state.message}</Banner> : null}
    </form>
  );
}

function Submit({ look }: { look: "button" | "text" }) {
  const { pending } = useFormStatus();

  if (look === "text") {
    return (
      <button
        type="submit"
        disabled={pending}
        className={`${TAP_TEXT} self-start text-sm text-ink-muted disabled:opacity-50`}
      >
        <span>
          Just looking?{" "}
          <span className="font-semibold text-ink underline underline-offset-4">
            {pending ? "Opening the demo…" : "Try the demo"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button type="submit" disabled={pending} className={`${buttonClass("quiet")} ${FOCUS_RING} md:max-w-xs`}>
      {pending ? "Opening the demo…" : "Try the demo"}
    </button>
  );
}
