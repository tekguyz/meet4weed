/**
 * The demo door's one decision (issue #39): may this press create a visitor?
 * Pure. It knows the env flag and the two rate-limit verdicts, and nothing
 * about auth — app/demo-actions.ts does the signing in.
 */

/** Shown when a limit is full. A limited visitor is not shown an error. */
export const DEMO_BUSY = "The demo is busy. Try again in a few minutes.";

/** Shown when the flag is off but a stale page still carried the button. */
export const DEMO_OFF = "The demo is closed right now.";

/** What every blocked action says to a visitor, so a refusal reads as a demo
 *  boundary rather than a broken app. */
export const NOT_IN_THE_DEMO = "Not available in the demo.";

/** The SQLSTATE the database raises for the same refusal. */
export const NOT_IN_THE_DEMO_CODE = "M4W40";

export type DoorInput = { enabled: boolean; ipAllowed: boolean; globalAllowed: boolean };
export type DoorVerdict = { open: true } | { open: false; message: string };

export function doorVerdict({ enabled, ipAllowed, globalAllowed }: DoorInput): DoorVerdict {
  if (!enabled) return { open: false, message: DEMO_OFF };
  if (!ipAllowed || !globalAllowed) return { open: false, message: DEMO_BUSY };
  return { open: true };
}
