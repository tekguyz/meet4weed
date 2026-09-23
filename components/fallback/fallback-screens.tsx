import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus";
import { APP_NAME } from "@/lib/env";

/**
 * The framework pages in the app's own look (issue #63): not found, error and
 * loading. Each one leaves a way back into the app, so no URL is a dead end.
 * `/` sends a member wherever they belong and a stranger to sign in.
 *
 * `framed` is for the copies inside the Frame: 24px top padding under its
 * header, 40px without one (DESIGN.md, Layout).
 */
type Placement = { framed?: boolean };

const column = (framed = false) =>
  `mx-auto flex w-full max-w-md flex-col gap-6 px-4 ${framed ? "py-6" : "py-10"}`;

/** What Next hands an error.tsx or global-error.tsx. `reset` is passed too,
 *  but `retry` is the one to use: it re-fetches as well as re-renders. */
export type ErrorPageProps = { error: Error & { digest?: string }; retry: () => void; reset: () => void };

function Screen({ title, framed, children }: Placement & { title: string; children: ReactNode }) {
  return (
    <div className={column(framed)}>
      <h1 className="text-3xl">{title}</h1>
      {children}
    </div>
  );
}

const BACK_LABEL = `Back to ${APP_NAME}`;

export function NotFoundScreen({ framed }: Placement) {
  return (
    <Screen title="Page not found" framed={framed}>
      <p className="text-sm text-ink-muted">
        This page is not here. The link may be wrong, or what it pointed to is gone — a cancelled sesh
        or a used-up invite ends up here too.
      </p>
      <Link href="/" className={`${buttonClass()} ${FOCUS_RING}`}>
        {BACK_LABEL}
      </Link>
    </Screen>
  );
}

/** Never shows what threw. The error's text can name tables, keys or rules a
 *  member has no business reading, so it stays in the logs. */
export function ErrorScreen({ onRetry, framed }: Placement & { onRetry: () => void }) {
  return (
    <Screen title="Something went wrong" framed={framed}>
      <p className="text-sm text-ink-muted">This page did not load. Try again, or go back to the app.</p>
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onRetry} className={`${buttonClass()} ${FOCUS_RING}`}>
          Try again
        </button>
        {/* A plain link, not a client navigation: the router may be what broke,
            and a full load starts clean. */}
        <a href="/" className={`${buttonClass("quiet")} ${FOCUS_RING}`}>
          {BACK_LABEL}
        </a>
      </div>
    </Screen>
  );
}

/** A calm stand-in while a page loads: the shape of a heading and two cards.
 *  Not a Banner — nothing has happened yet to give feedback about. */
export function LoadingScreen({ framed }: Placement) {
  return (
    <div aria-busy="true" className={column(framed)}>
      <p className="sr-only">Loading</p>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
        <div className="h-9 w-2/3 rounded-control bg-surface-2" />
        <div className="h-28 rounded-card bg-surface" />
        <div className="h-28 rounded-card bg-surface" />
      </div>
    </div>
  );
}
