"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms/action-state";

/**
 * Block (issue #111). Every rule lives in Postgres — see
 * supabase/migrations/…_blocks.sql. This action turns the answer into a calm
 * sentence and does nothing else.
 *
 * It tells nobody: no notification, ever. And it revalidates nothing. The
 * page it runs on is the blocked member's profile, which the wall now hides —
 * a refresh would swap the "done" card for a 404 before it could be read.
 * Every other screen is rendered per request, so it sees the wall on the next
 * visit anyway.
 *
 * Unblock (issue #112) runs from Me -> Blocked, so it does refresh that list.
 * It lifts the caller's own block and nothing else: old kicked or cancelled
 * RSVPs stay as they are (unblock_member touches none).
 */

const memberId = z.uuid();

const CANNOT_BLOCK = "Could not block that member.";
const CANNOT_UNBLOCK = "Could not unblock that member.";
const FALLBACK = "Could not do that just now. Try again.";

const MESSAGES: Record<string, string> = {
  M4W60: CANNOT_BLOCK,
};

export async function blockMember(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const member = memberId.safeParse(formData.get("memberId"));
  if (!member.success) return { ok: false, message: CANNOT_BLOCK };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const { error } = await supabase.rpc("block_member", { p_member: member.data });
  if (error) return { ok: false, message: (error.code && MESSAGES[error.code]) || FALLBACK };

  return { ok: true, message: "Blocked." };
}

export async function unblockMember(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const member = memberId.safeParse(formData.get("memberId"));
  if (!member.success) return { ok: false, message: CANNOT_UNBLOCK };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to continue." };

  const { error } = await supabase.rpc("unblock_member", { p_member: member.data });
  if (error) return { ok: false, message: FALLBACK };

  revalidatePath("/me/settings/blocked");
  return { ok: true, message: "Unblocked." };
}
