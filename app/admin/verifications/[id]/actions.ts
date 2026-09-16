"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removeDocuments } from "@/lib/verification/reaper";

/**
 * Approve, reject, or ask for a retake (spec §4.1 steps 9–10). The database
 * decides whether this admin may; only after it has agreed are the images
 * deleted (spec §4.2: "deleted the moment the reviewer decides").
 */

export type DecideState = { message: string } | null;

const Decision = z.discriminatedUnion("decision", [
  z.object({
    id: z.uuid(),
    decision: z.literal("approve"),
    cardExpiresOn: z.iso.date(),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    id: z.uuid(),
    decision: z.enum(["reject", "retake"]),
    reason: z.string().trim().min(1).max(500),
  }),
]);

const DATABASE_MESSAGES: Record<string, string> = {
  "42501": "Only an admin can decide.",
  "22023": "Check the expiry date and the reason.",
  M4W05: "This submission was already decided.",
};

export async function decideVerification(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const parsed = Decision.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const decision = formData.get("decision");
    return {
      message: decision === "approve" ? "Enter the expiry date printed on the card." : "Write the reason the member will read.",
    };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_verification", {
    p_id: input.id,
    p_decision: input.decision,
    p_reason: input.reason || null,
    p_card_expires_on: input.decision === "approve" ? input.cardExpiresOn : null,
  });
  if (error) return { message: DATABASE_MESSAGES[error.code] ?? "That did not save. Try again." };

  const admin = createAdminClient();
  const { data: docs } = await admin.from("verification_documents").select("id, storage_path").eq("verification_id", input.id);
  await removeDocuments(admin, (docs ?? []) as { id: string; storage_path: string }[]);

  redirect("/admin/verifications");
}
