"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { myUnreadCount } from "@/lib/notify/queries";

/**
 * The bell and the feed. A member may set read_at on their own rows and
 * nothing else — the column grant and the update policy say so, not this file.
 */

const ids = z.array(z.uuid()).max(100);

/** Marks the rows the member was shown as read. Only those: a row that landed
 *  after the page rendered stays unread, because nobody has seen it. */
export async function markSeen(seen: string[]): Promise<void> {
  const parsed = ids.safeParse(seen);
  if (!parsed.success || parsed.data.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", parsed.data)
    .is("read_at", null);
  if (error) console.error(`[notifications] mark seen failed: ${error.code}`);
}

/** The bell's number, re-read as the member moves around. A layout does not
 *  re-run on navigation, so the number it rendered with goes stale. */
export async function unreadCount(): Promise<number> {
  return myUnreadCount();
}
