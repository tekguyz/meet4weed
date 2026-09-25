import type { AuthFailure } from "@/lib/auth/auth-errors";

/** What the sign-in screens say for each failure. The design pass (spec §10
 *  step 12) owns the final words. */
export const FAILURE_TEXT: Record<AuthFailure, string> = {
  invalid_input: "Check the email address and password.",
  invalid_credentials: "That email and password do not match.",
  email_not_confirmed: "Confirm your email with the link we sent before you sign in.",
  invalid_code: "That link is wrong or has expired. Ask for a new one.",
  weak_password:
    "Use at least 8 characters, with an upper-case letter, a lower-case letter, a digit and a symbol.",
  same_password: "Choose a password you have not used on this account.",
  no_session: "Your reset link has run out. Ask for a new one.",
  email_send_limit: "Too many emails were sent recently. Try again later.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  unknown: "Something went wrong. Try again.",
};

/** Checked on the phone before anything is sent. A typo in a new password
 *  locks the member out of an account they just made. */
export const PASSWORDS_DIFFER = "The two passwords do not match.";

export const LINK = "min-h-11 text-left text-sm text-ink-muted underline";
