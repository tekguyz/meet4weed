import { LIVE_HINT_TEXT } from "@/lib/verification/messages";
import type { PrecheckProblem } from "@/lib/verification/prechecks";

/** Live guidance over the viewfinder (phone-test finding 4). The same
 *  pre-checks run on a small copy of the live video a few times a second.
 *  They only guide: the check on the full-size photo stays the gate. */
export const LIVE_CHECK = {
  longEdge: 320,
  intervalMs: 400,
} as const;

// Framing first: a blur or glare reading means little until the subject is in frame.
const ORDER: PrecheckProblem[] = ["no_card", "no_face", "glare", "blurry"];

export function liveHint(problems: readonly PrecheckProblem[]): string {
  const first = ORDER.find((p) => problems.includes(p));
  return first ? LIVE_HINT_TEXT[first] : LIVE_HINT_TEXT.ready;
}
