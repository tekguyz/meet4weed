import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CardReading } from "@/lib/verification/reading";

/** Every read here runs with the admin's own session. The admin policies in
 *  supabase/migrations/20260917090000_verification.sql decide what comes back;
 *  a non-admin simply gets nothing. */

/** Cached per request, like getMyProfile(). */
export const amIAdmin = cache(async function amIAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_i_admin");
  return !error && data === true;
});

export type PendingSubmission = {
  id: string;
  createdAt: string;
  handle: string;
  skippedReason: string | null;
  concernCount: number;
  visionError: string | null;
};

export async function listPending(): Promise<PendingSubmission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verifications")
    .select("id, created_at, vision_skipped_reason, vision_error, concerns, profiles(handle)")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    handle: ((row.profiles as unknown as { handle: string } | null)?.handle ?? "unknown") as string,
    skippedReason: row.vision_skipped_reason as string | null,
    visionError: row.vision_error as string | null,
    concernCount: ((row.concerns as string[] | null) ?? []).length,
  }));
}

export type Submission = {
  id: string;
  status: string;
  createdAt: string;
  handle: string;
  patientId: string;
  typedCardExpiresOn: string;
  challenge: string;
  reading: CardReading | null;
  concerns: string[];
  skippedReason: string | null;
  visionError: string | null;
  costUsd: number | null;
  documentKinds: string[];
};

export async function getSubmission(id: string): Promise<Submission | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("verifications")
    .select(
      "id, status, created_at, patient_id, typed_card_expires_on, challenge, reading, concerns, vision_skipped_reason, vision_error, cost_usd, profiles(handle), verification_documents(kind)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  return {
    id: row.id as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    handle: (row.profiles as unknown as { handle: string } | null)?.handle ?? "unknown",
    patientId: row.patient_id as string,
    typedCardExpiresOn: row.typed_card_expires_on as string,
    challenge: row.challenge as string,
    reading: row.reading as CardReading | null,
    concerns: (row.concerns as string[] | null) ?? [],
    skippedReason: row.vision_skipped_reason as string | null,
    visionError: row.vision_error as string | null,
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    documentKinds: ((row.verification_documents as { kind: string }[] | null) ?? []).map((d) => d.kind),
  };
}

export async function getSpend() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("verification_spend");
  const row = (data as { today_usd: number; month_usd: number; today_calls: number; month_calls: number }[] | null)?.[0];
  return {
    todayUsd: Number(row?.today_usd ?? 0),
    monthUsd: Number(row?.month_usd ?? 0),
    todayCalls: row?.today_calls ?? 0,
    monthCalls: row?.month_calls ?? 0,
  };
}
