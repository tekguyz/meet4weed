/**
 * Supabase Auth errors, narrowed to the closed set the sign-in screens can
 * show. Copied from tekguyz-squid-ink (c8ceb09).
 *
 * Keyed on `error.code`, never on `error.message`: the message is prose that
 * Supabase rewords, the code is the contract.
 *
 * `otp_expired` is what Supabase answers for a WRONG token as well as a stale
 * one — it does not tell the two apart, so neither does this.
 */
export type AuthFailure =
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "invalid_code"
  | "weak_password"
  | "same_password"
  | "no_session"
  | "email_send_limit"
  | "rate_limited"
  | "unknown";

const BY_CODE: Record<string, AuthFailure> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  otp_expired: "invalid_code",
  weak_password: "weak_password",
  same_password: "same_password",
  session_not_found: "no_session",
  // "Secure password change" wants a fresh sign-in on an old session.
  reauthentication_needed: "no_session",
  over_email_send_rate_limit: "email_send_limit",
  over_request_rate_limit: "rate_limited",
  validation_failed: "invalid_input",
  email_address_invalid: "invalid_input",
};

export function toAuthFailure(error: { code?: string; message?: string }): AuthFailure {
  const failure = error.code ? BY_CODE[error.code] : undefined;
  if (failure) return failure;
  // Logged, because "unknown" on screen is the whole of what the user sees.
  console.error(`[auth] unmapped error ${error.code ?? "(no code)"}: ${error.message ?? ""}`);
  return "unknown";
}

/**
 * Failures that say nothing about whether an address has an account. Sign-up,
 * resend and reset may show only these; every other failure is logged and
 * answered as success (spec §4.5 — the same response for a known and an
 * unknown address).
 *
 * `email_send_limit` is NOT here. Supabase's per-address `max_frequency` check
 * answers `over_email_send_rate_limit` only for an address it would actually
 * mail, so showing it would reveal a member.
 */
const ADDRESS_BLIND: ReadonlySet<AuthFailure> = new Set([
  "invalid_input",
  "weak_password",
  "rate_limited",
]);

export function isAddressBlind(failure: AuthFailure): boolean {
  return ADDRESS_BLIND.has(failure);
}
