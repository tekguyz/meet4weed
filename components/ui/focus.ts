/** The visible focus ring for links and buttons (DESIGN.md, Do's). Fields have
 *  their own: the border turns Sage. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** A text link or text button that stands on its own line: a 44px tap target
 *  both ways (spec §7.1) and the focus ring. A link inside a sentence stays
 *  inline and does not use this — WCAG 2.5.8 exempts it. */
export const TAP_TEXT = `inline-flex min-h-11 min-w-11 items-center ${FOCUS_RING}`;
