import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus";

/** Where a member's profile lives (issue #64). A handle matches
 *  profiles_handle_format, so nothing in one needs escaping. */
export function profilePath(handle: string): string {
  return `/m/${handle}`;
}

/** A handle, linked to its profile, at the 44px tap height (spec §7.1).
 *  Whether the reader may open it is the database's call: the profiles select
 *  policy answers, and the page shows the 404 when it says no. */
export function HandleLink({ handle, className = "" }: { handle: string; className?: string }) {
  return (
    <Link href={profilePath(handle)} className={`inline-flex min-h-11 items-center text-ink underline underline-offset-2 ${FOCUS_RING} ${className}`}>
      @{handle}
    </Link>
  );
}
