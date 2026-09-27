"use client";

import { useFormStatus } from "react-dom";
import { leaveDemo } from "@/app/demo-actions";
import { FOCUS_RING } from "@/components/ui/focus";
import { BANNER_LINK } from "./banner-link";

/**
 * "Leave demo" (issue #39). A form button, like every sign-out: a GET
 * sign-out can be fired by an <img> on any page. Signing out takes a second
 * or two, so it says so and cannot be pressed twice.
 */
export function LeaveDemoButton() {
  return (
    <form action={leaveDemo}>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${BANNER_LINK} ${FOCUS_RING}`}>
      {pending ? "Leaving…" : "Leave demo"}
    </button>
  );
}
