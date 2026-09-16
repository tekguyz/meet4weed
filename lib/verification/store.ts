import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberStatus } from "@/lib/profiles/schema";
import { encryptImage } from "@/lib/verification/image-crypto";
import type { CardReading } from "@/lib/verification/reading";

/** Every database and Storage write a submission makes, behind one interface
 *  so the pipeline can be tested without a network. Runs with the service
 *  client: the route has already established who the member is. */

export const BUCKET = "verification-images";

export type DocumentKind = "card" | "face_with_card";

export type BeginFailure = "not_attested" | "already_pending" | "suspended" | "card_expired";

export type RecordedVision = {
  reading: CardReading | null;
  concerns: string[];
  skippedReason: "daily_ceiling" | "limiter_unavailable" | null;
  error: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
};

export type VerificationStore = {
  getMember(memberId: string): Promise<{ attested: boolean; status: MemberStatus } | null>;
  begin(input: { memberId: string; patientId: string; cardExpiresOn: string; challenge: string }): Promise<
    { ok: true; id: string } | { ok: false; code: BeginFailure }
  >;
  storeImage(input: { memberId: string; verificationId: string; kind: DocumentKind; bytes: Buffer }): Promise<void>;
  recordVision(verificationId: string, recorded: RecordedVision): Promise<void>;
  lapse(verificationId: string): Promise<void>;
};

const BEGIN_FAILURES: Record<string, BeginFailure> = {
  M4W01: "not_attested",
  M4W02: "already_pending",
  M4W03: "suspended",
  M4W04: "card_expired",
};

export const imagePath = (memberId: string, verificationId: string, kind: DocumentKind) =>
  `${memberId}/${verificationId}/${kind}.bin`;

export function createStore(db: SupabaseClient, secret: string): VerificationStore {
  return {
    async getMember(memberId) {
      const { data } = await db.from("profiles").select("status, attested_at").eq("id", memberId).maybeSingle();
      return data ? { attested: data.attested_at !== null, status: data.status as MemberStatus } : null;
    },

    async begin({ memberId, patientId, cardExpiresOn, challenge }) {
      const { data, error } = await db.rpc("begin_verification", {
        p_member_id: memberId,
        p_patient_id: patientId,
        p_card_expires_on: cardExpiresOn,
        p_challenge: challenge,
      });
      if (error) {
        const code = BEGIN_FAILURES[error.code ?? ""];
        if (code) return { ok: false, code };
        throw new Error(`begin_verification failed: ${error.code}`);
      }
      return { ok: true, id: data as string };
    },

    async storeImage({ memberId, verificationId, kind, bytes }) {
      const sealed = encryptImage(secret, bytes);
      const path = imagePath(memberId, verificationId, kind);
      const upload = await db.storage
        .from(BUCKET)
        .upload(path, sealed, { contentType: "application/octet-stream", upsert: false });
      if (upload.error) throw new Error(`upload failed for ${kind}`);

      const { error } = await db.from("verification_documents").insert({
        verification_id: verificationId,
        kind,
        storage_path: path,
        byte_size: sealed.length,
      });
      if (error) throw new Error(`document row failed for ${kind}: ${error.code}`);
    },

    async recordVision(verificationId, r) {
      const { error } = await db
        .from("verifications")
        .update({
          reading: r.reading,
          concerns: r.concerns,
          vision_skipped_reason: r.skippedReason,
          vision_error: r.error,
          model: r.model,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          cost_usd: r.costUsd,
        })
        .eq("id", verificationId);
      if (error) throw new Error(`recording the reading failed: ${error.code}`);
    },

    async lapse(verificationId) {
      const { error } = await db.rpc("lapse_verification", { p_id: verificationId });
      if (error) throw new Error(`lapse failed: ${error.code}`);
    },
  };
}
