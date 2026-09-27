import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus";
import { NOT_IN_THE_DEMO } from "@/lib/demo/door";

/**
 * What a visitor sees in place of something the demo does not allow (#39).
 * The feature is still there to look at in the list; pressing into it says
 * why it stops and where to go instead, so a refusal reads as a demo boundary
 * rather than a bug. The database or the action refuses it too — this is only
 * the sentence.
 *
 * A notice card from DESIGN.md, but not a live region: it is the page, not
 * news, so a screen reader should not announce it on arrival.
 */
export function NotInDemo() {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 text-sm">
      <p className="font-semibold text-ink">{NOT_IN_THE_DEMO}</p>
      <p className="text-ink-muted">
        Members can do this in the real app. The demo keeps it off so nothing you do here reaches
        anyone else.
      </p>
      <Link
        href="/seshes"
        className={`inline-flex min-h-11 items-center self-start font-semibold text-ink underline underline-offset-4 hover:text-ink-muted ${FOCUS_RING}`}
      >
        Back to seshes
      </Link>
    </div>
  );
}
