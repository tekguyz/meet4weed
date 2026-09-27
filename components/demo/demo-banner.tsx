import { leaveDemo } from "@/app/demo-actions";
import { FOCUS_RING } from "@/components/ui/focus";

const LINK = `inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-ink-muted ${FOCUS_RING}`;

/**
 * The one piece of demo chrome (issue #39): a line on every signed-in screen
 * a visitor sees. It says plainly that the data is invented, who built the
 * app, and how to get out. No tour, no tooltips.
 *
 * "Leave demo" is a form button, like every sign-out: a GET sign-out can be
 * fired by an <img> on any page.
 */
export function DemoBanner() {
  return (
    <aside
      aria-label="Demo"
      className="bg-surface-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex w-full max-w-md flex-wrap items-center gap-x-3 px-4 text-xs text-ink-muted md:max-w-3xl">
        <p className="py-3">
          <span className="font-semibold text-ink">Demo</span> — every member and sesh here is invented
        </p>
        <span aria-hidden="true">·</span>
        <a href="https://tekguyz.com" className={LINK}>
          Built by TEKGUYZ
        </a>
        <span aria-hidden="true">·</span>
        <form action={leaveDemo}>
          <button type="submit" className={LINK}>
            Leave demo
          </button>
        </form>
      </div>
    </aside>
  );
}
