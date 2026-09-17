import "server-only";
import { z } from "zod";
import { checkUploadedImage } from "@/lib/verification/jpeg";
import type { Limits } from "@/lib/verification/limits";
import type { RecordedVision, VerificationStore } from "@/lib/verification/store";
import type { VisionInput, VisionResult } from "@/lib/verification/vision";

/**
 * One submission, start to finish (spec §4.1 steps 7–8, §4.4).
 *
 * The order is the contract: cheapest refusal first, and nothing before the
 * daily-ceiling check can reach Claude. lib/verification/__tests__/submit.test.ts
 * proves each limit skips the call.
 */

export type SubmissionError =
  | "sign_in"
  | "not_attested"
  | "suspended"
  | "already_pending"
  | "invalid_fields"
  | "card_expired"
  | "missing_image"
  | "not_jpeg"
  | "image_too_large"
  | "challenge_expired"
  | "member_limit"
  | "ip_limit"
  | "storage_failed";

export type SubmissionOutcome =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 401 | 403 | 409 | 413 | 415 | 429 | 500; body: { ok: false; error: SubmissionError } };

export type SubmissionInput = {
  memberId: string | null;
  ip: string;
  patientId: unknown;
  cardExpiresOn: unknown;
  challengeToken: unknown;
  card: Uint8Array | null;
  face: Uint8Array | null;
};

export type SubmitDeps = {
  store: VerificationStore;
  limits: Limits;
  vision: (input: VisionInput) => Promise<VisionResult>;
  alertOwner: () => Promise<void>;
  verifyChallenge: (token: string, memberId: string) => string | null;
  today: () => string;
};

const Fields = z.object({
  // Stored upper-case, whatever the phone's keyboard sent (phone-test finding 5).
  patientId: z.string().trim().min(1).max(40).toUpperCase(),
  cardExpiresOn: z.iso.date(),
});

const fail = (status: 400 | 401 | 403 | 409 | 413 | 415 | 429 | 500, error: SubmissionError): SubmissionOutcome => ({
  status,
  body: { ok: false, error },
});

const skipped = (reason: "daily_ceiling" | "limiter_unavailable"): RecordedVision => ({
  reading: null,
  concerns: [],
  skippedReason: reason,
  error: null,
  model: null,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
});

export async function submitVerification(input: SubmissionInput, deps: SubmitDeps): Promise<SubmissionOutcome> {
  // 1–2. Who is asking.
  if (!input.memberId) return fail(401, "sign_in");
  const member = await deps.store.getMember(input.memberId);
  if (!member) return fail(401, "sign_in");
  if (!member.attested) return fail(403, "not_attested");
  if (member.status === "suspended") return fail(403, "suspended");
  if (member.status === "pending_review") return fail(409, "already_pending");

  // 3. What they typed.
  const fields = Fields.safeParse({ patientId: input.patientId, cardExpiresOn: input.cardExpiresOn });
  if (!fields.success) return fail(400, "invalid_fields");
  const today = deps.today();
  if (fields.data.cardExpiresOn < today) return fail(400, "card_expired");

  // 4. The images, by their bytes (control 6).
  if (!input.card || !input.face) return fail(400, "missing_image");
  for (const bytes of [input.card, input.face]) {
    const problem = checkUploadedImage(bytes);
    if (problem === "not_jpeg" || problem === "unreadable") return fail(415, "not_jpeg");
    if (problem) return fail(413, "image_too_large");
  }

  // 5. The challenge the server issued to this member.
  const challenge =
    typeof input.challengeToken === "string" ? deps.verifyChallenge(input.challengeToken, input.memberId) : null;
  if (!challenge) return fail(400, "challenge_expired");

  // 6. Per-member and per-IP limits (control 3).
  const claim = await deps.limits.claimSubmission(input.memberId, input.ip, today);
  if (!claim.ok) return fail(429, claim.reason);

  // 7. The submission row; the member moves to pending_review.
  const begun = await deps.store.begin({
    memberId: input.memberId,
    patientId: fields.data.patientId,
    cardExpiresOn: fields.data.cardExpiresOn,
    challenge,
  });
  if (!begun.ok) {
    const status = begun.code === "already_pending" ? 409 : begun.code === "card_expired" ? 400 : 403;
    return fail(status, begun.code);
  }

  // 8. Both images, encrypted, before any Claude call: a failed read must
  // still leave something for a person to review.
  const card = Buffer.from(input.card);
  const face = Buffer.from(input.face);
  try {
    await deps.store.storeImage({ memberId: input.memberId, verificationId: begun.id, kind: "card", bytes: card });
    await deps.store.storeImage({ memberId: input.memberId, verificationId: begun.id, kind: "face_with_card", bytes: face });
  } catch (error) {
    console.error(`[verification] storing images failed: ${(error as Error).message}`);
    await deps.store.lapse(begun.id).catch(() => undefined);
    return fail(500, "storage_failed");
  }

  // 9. The daily ceiling (control 4), then Claude.
  let recorded: RecordedVision;
  const allowed = claim.limiterAvailable && (await deps.limits.claimVisionCall(today));
  if (!allowed) {
    recorded = skipped(claim.limiterAvailable ? "daily_ceiling" : "limiter_unavailable");
  } else {
    const result = await deps.vision({
      card,
      face,
      typedPatientId: fields.data.patientId,
      typedExpiry: fields.data.cardExpiresOn,
      challenge,
      today,
    });
    recorded = {
      reading: result.ok ? result.reading : null,
      concerns: result.ok ? result.reading.concerns : [],
      skippedReason: null,
      error: result.ok ? null : result.error,
      model: result.model,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      costUsd: result.costUsd,
    };
  }

  // 10. Tokens and cost, logged per call (control 8).
  try {
    await deps.store.recordVision(begun.id, recorded);
  } catch (error) {
    console.error(`[verification] ${(error as Error).message}`);
  }

  // 11. The owner hears about it. A lost alert is logged, not the member's problem.
  try {
    await deps.alertOwner();
  } catch (error) {
    console.error(`[verification] owner alert failed: ${(error as Error).message}`);
  }

  return { status: 200, body: { ok: true } };
}
