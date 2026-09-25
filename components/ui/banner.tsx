import type { ReactNode } from "react";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * The one inline feedback line (issue #61). It sits next to the thing it is
 * about and stays until the page changes — no toasts, because a toast is gone
 * before a slow reader sees it.
 *
 * A notice card from DESIGN.md: the text colour carries the tone.
 */
type Tone = "info" | "success" | "warning" | "danger";

const TONES = {
  info: "text-ink",
  success: "text-primary",
  warning: "text-secondary",
  danger: "text-danger",
} as const satisfies Record<Tone, string>;

// DESIGN.md "Cards / Containers": Ember Raised and 12px when nested.
const SURFACE = "rounded-card bg-surface p-4";
const NESTED_SURFACE = "rounded-card bg-surface-2 p-3";

type Props = {
  tone?: Tone;
  /** Inside a card that is already Ember Card. */
  nested?: boolean;
  /** An error the member must hear at once (issue #75): `role="alert"`
   *  interrupts a screen reader, where `status` waits its turn. */
  urgent?: boolean;
  className?: string;
  children: ReactNode;
};

export function Banner({ tone = "info", nested = false, urgent = false, className = "", children }: Props) {
  return (
    <div
      {...(urgent ? { role: "alert" } : { role: "status", "aria-live": "polite" as const })}
      className={`${nested ? NESTED_SURFACE : SURFACE} text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/** A server action's answer, under the form that ran it. Nothing until it has run. */
export function ActionResult({ state, nested = false }: { state: ActionState | null; nested?: boolean }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? "success" : "danger"} nested={nested}>
      {state.message}
    </Banner>
  );
}

/**
 * An error about one field, under that field (issue #75). Small text, not a
 * card: it must sit tight under the box it names, and a card under every box
 * would bury the form. Still `role="alert"`, so it is heard at once.
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}
