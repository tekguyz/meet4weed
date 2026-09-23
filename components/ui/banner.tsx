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
  className?: string;
  children: ReactNode;
};

export function Banner({ tone = "info", nested = false, className = "", children }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
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
