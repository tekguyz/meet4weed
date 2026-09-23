import Link from "next/link";
import type { ReactNode } from "react";
import { FOCUS_RING } from "@/components/ui/focus";

/**
 * The grouped list Me and Settings are built from (issue #65, shape brief
 * `.impeccable/surfaces/route-me.md` §6): full-width rows, 44px or taller,
 * each opening one page. Like iOS Settings, not one long form.
 */
export function RowGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label ? <h2 className="px-1 text-xs font-semibold uppercase tracking-widest text-ink-muted">{label}</h2> : null}
      <ul className="flex flex-col divide-y divide-rule overflow-hidden rounded-card bg-surface">{children}</ul>
    </section>
  );
}

const ROW = "flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm";

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={`${ROW} text-ink hover:bg-surface-2 ${FOCUS_RING}`}>
        <span className="min-w-0 truncate">{children}</span>
        <Chevron />
      </Link>
    </li>
  );
}

/** A place kept for a later plan. It says so and opens nothing. */
export function HeldRow({ children }: { children: ReactNode }) {
  return (
    <li className={`${ROW} text-ink-muted`}>
      <span>{children}</span>
      <span className="text-xs">Coming soon</span>
    </li>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-ink-muted"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
