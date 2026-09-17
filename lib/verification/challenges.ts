/** What the member is asked to do in the face-with-card photo (spec §4.1 step
 *  5). Each one is visible in a single still photo, needs no special ability,
 *  and uses the face only: one hand holds the phone and the other holds the
 *  card (phone-test finding 3, 2026-09-16). The server picks one; see
 *  challenge-token.ts. Tokens carry an index, so reordering this list only
 *  invalidates tokens issued in the last 15 minutes. */
export const CHALLENGES = [
  "Smile with your teeth showing",
  "Tilt your head to one side",
  "Raise your eyebrows",
  "Close one eye",
  "Open your mouth wide",
  "Puff out your cheeks",
  "Turn your head a little to one side",
  "Frown",
] as const;
