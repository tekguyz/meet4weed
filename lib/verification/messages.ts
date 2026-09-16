import type { SubmissionError } from "@/lib/verification/submit";
import type { PrecheckProblem } from "@/lib/verification/prechecks";

/** Spec §4.2 — shown before the camera opens, and true. */
export const RETENTION_STATEMENT =
  "A person on our team checks your card, and your photos are deleted as soon as they do — within 7 days at the most.";

export const PRECHECK_TEXT: Record<PrecheckProblem, string> = {
  blurry: "The photo is blurry. Hold the phone still and try again.",
  glare: "There is glare on the card. Tilt it away from the light.",
  no_card: "We cannot see the card's edges. Fit the card inside the frame.",
  no_face: "We cannot see your face. Hold the phone at arm's length, face on.",
};

// Spec §8: every failure names the reason and offers a way forward.
export const SUBMISSION_TEXT: Record<SubmissionError, string> = {
  sign_in: "Your session ended. Sign in again, then retake the photos.",
  not_attested: "Finish the four claims on your profile first.",
  suspended: "This account is suspended. Contact us if you think that is a mistake.",
  already_pending: "Your card is already waiting for a person to check it.",
  invalid_fields: "Check the patient ID and the expiry date.",
  card_expired: "The expiry date you typed has passed. Renew your card with the state first.",
  missing_image: "Both photos are needed. Retake the missing one.",
  not_jpeg: "That photo could not be read. Retake it in the app.",
  image_too_large: "That photo is too large. Retake it in the app.",
  challenge_expired: "The pose request timed out. Retake the photo with the new request.",
  member_limit: "You have tried 3 times today. Try again tomorrow.",
  ip_limit: "Too many attempts from this network today. Try again tomorrow.",
  storage_failed: "Something went wrong saving your photos. Try again in a minute.",
};
