import type { ReactNode } from "react";

/**
 * The one inline feedback line (issue #61). It sits next to the thing it is
 * about and stays until the page changes — no toasts, because a toast is gone
 * before a slow reader sees it.
 *
 * A notice card from DESIGN.md: the text colour carries the tone.
 */
export type BannerTone = "info" | "success" | "warning" | "danger";

const TONES = {
  info: "text-ink",
  success: "text-primary",
  warning: "text-secondary",
  danger: "text-danger",
} as const satisfies Record<BannerTone, string>;

type Props = {
  tone?: BannerTone;
  className?: string;
  children: ReactNode;
};

export function Banner({ tone = "info", className = "", children }: Props) {
  return (
    <div role="status" aria-live="polite" className={`rounded-card bg-surface p-4 text-sm ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}
