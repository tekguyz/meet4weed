import { createClient } from "@/lib/supabase/server";

export type MyVerification = { status: string; decisionReason: string | null; createdAt: string };

/** The member's latest submission, through the only door they have to it. */
export async function getMyVerification(): Promise<MyVerification | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_verification_status");
  const row = (data as { status: string; decision_reason: string | null; created_at: string }[] | null)?.[0];
  return row ? { status: row.status, decisionReason: row.decision_reason, createdAt: row.created_at } : null;
}
