import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * A Push subscription is one browser on one device (see CONTEXT.md). These
 * two write it with the admin client, always scoped to a member the caller
 * has already signed in: a member has no SELECT on the table, and choosing
 * one device's row is a filter, which is a read. See the migration.
 */

/** What PushSubscription.toJSON() hands over, checked before it is stored. */
export const DeviceSubscription = z.object({
  endpoint: z.url().startsWith("https://").max(1024),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

export type DeviceSubscription = z.infer<typeof DeviceSubscription>;

/**
 * Saves this device for this member. A device already saved moves to the
 * member now signed in on it: whoever holds the phone gets its pushes, and
 * the member who signed out stops getting them there.
 *
 * So whoever presents an endpoint takes it. An endpoint is an unguessable URL
 * only the browser holds; a stranger who somehow had one could only point
 * their own discreet "You have an update" at that phone. Accepted.
 */
export async function saveDevice(
  admin: SupabaseClient,
  memberId: string,
  device: DeviceSubscription,
  userAgent: string | null,
): Promise<void> {
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      member_id: memberId,
      endpoint: device.endpoint,
      p256dh: device.keys.p256dh,
      auth: device.keys.auth,
      user_agent: userAgent?.slice(0, 512) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`push subscription not saved: ${error.code}`);
}

/** Forgets one device, and only if it is this member's. */
export async function forgetDevice(admin: SupabaseClient, memberId: string, endpoint: string): Promise<void> {
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("member_id", memberId);
  if (error) throw new Error(`push subscription not removed: ${error.code}`);
}
