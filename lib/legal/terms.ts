/** The terms a member agrees to at attestation (issue #68). Written to
 *  `profiles.terms_version` in the same statement as `attested_at`, so every
 *  attested member carries a record of which text they agreed to.
 *
 *  Change this when the owner changes Terms, Privacy or the Community rules in
 *  a way that matters. v1 only records it: a member who agreed to an older
 *  version is never forced to agree again.
 *
 *  "draft" because the pages hold placeholder copy. The owner's real text
 *  ships with a new value. */
export const TERMS_VERSION = "draft-2026-09-24";
