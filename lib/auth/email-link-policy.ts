/**
 * How long an emailed confirmation or password-reset LINK stays usable, as the
 * screens and the email copy state it. Spec §4.5: one hour.
 *
 * This number is ALSO Supabase Auth config, and the two must never disagree:
 * copy that says "expires in 60 minutes" over a link that lives a day is copy
 * lying about its own link.
 *
 * - `supabase/config.toml` [auth.email] `otp_expiry` — Supabase uses the one
 *   setting for codes and links alike. lib/auth/__tests__/email-link-policy.test.ts
 *   fails when it drifts from this constant, or when a template's copy does.
 * - The HOSTED project's "Email OTP expiration", set in the dashboard
 *   (Authentication → Providers → Email). config.toml mirrors it; this repo
 *   never runs `supabase config push`.
 */
export const EMAIL_LINK_EXPIRY_SECONDS = 3600;
export const EMAIL_LINK_EXPIRY_MINUTES = EMAIL_LINK_EXPIRY_SECONDS / 60;
