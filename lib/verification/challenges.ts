/** What the member is asked to do in the face-with-card photo (spec §4.1 step
 *  5). Each one is visible in a single still photo and needs no special
 *  ability. The server picks one; see challenge-token.ts. */
export const CHALLENGES = [
  "Hold up two fingers beside the card",
  "Hold up three fingers beside the card",
  "Give a thumbs up with your free hand",
  "Touch your ear with your free hand",
  "Cover one eye with your free hand",
  "Hold the card under your chin",
  "Point at the card with your free hand",
  "Tilt your head to one side",
] as const;
