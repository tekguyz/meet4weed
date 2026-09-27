/** The demo banner's two actions share one look: small, underlined, a 44px
 *  row. Its own module because the banner is a server component and "Leave
 *  demo" is a client one; a server file cannot import a plain value from a
 *  "use client" file — it gets a client reference, not the string. */
export const BANNER_LINK =
  "inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-ink-muted";
