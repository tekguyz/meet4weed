import type { ReactNode } from "react";

/**
 * The three page shapes (#125; DESIGN.md, Layout). A Frame page picks one and
 * never writes its own width, so the widths live here and nowhere else.
 *
 * Every shape sits in the same 1152px cap and side padding as the Frame
 * header's inner row, so the header and the page line up.
 */

/** The cap, shared with the Frame header (components/frame/frame.tsx). */
export const PAGE_CAP = "mx-auto w-full max-w-6xl px-4 md:px-8";

/** One column: 448px on a phone, 672px from `md` up, more room between parts. */
const COLUMN = "mx-auto flex w-full max-w-md flex-col gap-6 md:max-w-2xl md:gap-8";

/** Header 3.5rem + the page's 1.5rem top padding: where a sticky side stops. */
const STICKY = "lg:sticky lg:top-20";

/** Column — Notifications, Settings, Verify, Onboarding, Your seshes. */
export function ColumnPage({ children }: { children: ReactNode }) {
  return (
    <div className={`${PAGE_CAP} py-6`}>
      <div className={COLUMN}>{children}</div>
    </div>
  );
}

/**
 * Split — from `lg` up a main column and a narrower side column that stays in
 * place on scroll. Below `lg`, one column, main first.
 */
export function SplitPage({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className={`${PAGE_CAP} py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10`}>
      <div className={`${COLUMN} lg:max-w-none`}>{main}</div>
      <div className={`${COLUMN} mt-6 md:mt-8 lg:mt-0 lg:max-w-none ${STICKY}`}>{side}</div>
    </div>
  );
}

/**
 * Feed — from `lg` up the list on the left and the map on the right, sticky
 * and as tall as the screen. Below `lg`, one column.
 *
 * `side` undefined means there is no map at all (an empty feed), and the list
 * stays one centred column. `side` null keeps the map's place at `lg` while it
 * waits for the browser to say the screen is wide, so nothing jumps.
 */
export function FeedPage({ main, side }: { main: ReactNode; side?: ReactNode }) {
  if (side === undefined) return <ColumnPage>{main}</ColumnPage>;

  return (
    <div className={`${PAGE_CAP} py-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8`}>
      <div className={`${COLUMN} lg:max-w-none`}>{main}</div>
      <div className={`hidden lg:flex lg:h-[calc(100dvh-6.5rem)] lg:flex-col ${STICKY}`}>{side}</div>
    </div>
  );
}
