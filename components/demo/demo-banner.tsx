import { FOCUS_RING } from "@/components/ui/focus";
import { BANNER_LINK } from "./banner-link";
import { LeaveDemoButton } from "./leave-demo-button";

/**
 * The one piece of demo chrome (issue #39): a line on every signed-in screen
 * a visitor sees. It says plainly that the data is invented, who built the
 * app, and how to get out. No tour, no tooltips.
 *
 * It scrolls away with the page rather than sticking: on a phone it is two
 * rows, and two sticky rows on top of the sticky Frame header would eat the
 * screen. "Leave demo" is also on Me → Sessions, as Sign out.
 *
 * On a phone the sentence takes the first row and the two actions the second,
 * with no dot between rows. From `md` up it is one line with dots.
 */
export function DemoBanner() {
  return (
    <aside
      aria-label="Demo"
      className="bg-surface-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex w-full max-w-md flex-col px-4 text-xs text-ink-muted md:max-w-3xl md:flex-row md:items-center md:gap-x-3">
        <p className="pt-3 md:py-3">
          <span className="font-semibold text-ink">Demo</span> — every member and sesh here is invented
        </p>
        <div className="flex items-center gap-x-4 md:gap-x-3">
          <span aria-hidden="true" className="hidden md:inline">
            ·
          </span>
          <a href="https://tekguyz.com" className={`${BANNER_LINK} ${FOCUS_RING}`}>
            <span>
              Built by <span translate="no">TEKGUYZ</span>
            </span>
          </a>
          <span aria-hidden="true" className="hidden md:inline">
            ·
          </span>
          <LeaveDemoButton />
        </div>
      </div>
    </aside>
  );
}
