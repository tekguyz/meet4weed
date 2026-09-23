import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "quiet";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const BASE =
  "inline-flex w-full items-center justify-center rounded-control px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50";

const VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-pressed",
  quiet: "bg-surface-2 text-ink hover:bg-rule",
} as const;

/** For a link that should look like a button — a next step that navigates. */
export function buttonClass(variant: Variant = "primary") {
  return `${BASE} ${VARIANTS[variant]}`;
}

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}
