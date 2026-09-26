"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { myUnreadCount } from "@/lib/notify/queries";

/**
 * The bell and the notification feed. Neither action checks who is calling:
 * RLS is the whole rule. A caller only ever counts, or marks, their own rows —
 * the select and update policies say so, and the column grant allows read_at
 * and nothing else. A signed-out caller matches no rows.
 */

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

/** Marks every unread row up to the newest one the page showed. A row that
 *  landed after the render stays unread, because nobody has seen it. */
export async function markSeenThrough(newestShown: string): Promise<void> {
  const parsed = timestamp.safeParse(newestShown);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .lte("created_at", parsed.data)
    .is("read_at", null);
  if (error) console.error(`[notifications] mark seen failed: ${error.code}`);
}

/** The bell's number, re-read as the member moves around. A layout does not
 *  re-run on navigation, so the number it rendered with goes stale. */
export async function unreadCount(): Promise<number> {
  return myUnreadCount();
}
