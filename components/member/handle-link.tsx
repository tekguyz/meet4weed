import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus";

/** Where a member's profile lives (issue #64). Handles are `[a-z0-9_]`, so
 *  nothing in one needs escaping. */
export function profilePath(handle: string): string {
  return `/m/${handle}`;
}

/** A handle, linked to its profile. Whether the reader may open it is the
 *  database's call: the profiles select policy answers, and the page shows the
 *  404 when it says no. */
export function HandleLink({ handle, className = "" }: { handle: string; className?: string }) {
  return (
    <Link href={profilePath(handle)} className={`text-ink underline-offset-2 hover:underline ${FOCUS_RING} ${className}`}>
      @{handle}
    </Link>
  );
}
