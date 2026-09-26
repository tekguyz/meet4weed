import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { APP_URL } from "@/lib/env";
import type { NotificationRow } from "@/lib/notify/events";
import { pushMessage } from "@/lib/notify/push-text";
import { serverEnv } from "@/lib/server-env";

/**
 * Web push: a tap on the shoulder after the feed row is written (spec §8).
 * Best-effort. Nothing here throws, and a failure is never shown to the
 * member — the row is already in their feed.
 *
 * The sender is injected, like EmailSender in lib/email.ts, so tests drive a
 * fake and no key is needed to run them.
 */
export type PushSender = {
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: { TTL?: number; urgency?: "low" | "normal" | "high"; timeout?: number },
  ): Promise<unknown>;
};

/** The project's own VAPID keys, no push vendor. Null when the keys are not
 *  set, which turns push off and leaves the feed working. The private key is
 *  read here, through server-env, and never leaves the server. */
export function webPushFromEnv(): PushSender | null {
  const env = serverEnv();
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const vapidDetails = { subject: APP_URL, publicKey, privateKey };
  return {
    sendNotification: (subscription, payload, options) =>
      webpush.sendNotification(subscription, payload, { ...options, vapidDetails }),
  };
}

/** A member with more devices than this is not a member, it is a script. The
 *  newest are the ones still in someone's hand. */
const DEVICES_PER_MEMBER = 10;
/** Keeps the member_id list inside a sane URL length. */
const CHUNK = 100;
/** The member's action waits on these sends (all devices at once), so a
 *  slow push service gets 3 seconds, then is dropped. Awaited rather than
 *  run after the response, because a serverless function may stop then. */
const OPTIONS = { TTL: 86_400, urgency: "normal", timeout: 3_000 } as const;

type Row = Pick<NotificationRow, "recipient_id" | "type">;
type Sub = { id: string; member_id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Pushes one discreet notice to every device of every recipient. Takes the
 * admin client: only service_role may read a subscription. A null sender
 * means push is off; undefined means the one built from the environment.
 *
 * A 404 or 410 means the device is gone for good, so its row is deleted on
 * the spot. Every other error is dropped.
 */
export async function pushNotices(
  db: SupabaseClient,
  sender: PushSender | null | undefined,
  rows: readonly Row[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    // Undefined means "the real one". Read inside the try, so even a broken
    // environment cannot turn a written notice into an error.
    const active = sender === undefined ? webPushFromEnv() : sender;
    if (!active) return;
    const byMember = new Map<string, Row[]>();
    for (const row of rows) byMember.set(row.recipient_id, [...(byMember.get(row.recipient_id) ?? []), row]);

    const members = [...byMember.keys()];
    for (let i = 0; i < members.length; i += CHUNK) {
      const { data, error } = await db
        .from("push_subscriptions")
        .select("id, member_id, endpoint, p256dh, auth")
        .in("member_id", members.slice(i, i + CHUNK))
        .order("updated_at", { ascending: false });
      if (error) {
        console.warn(`[push] subscriptions not read: ${error.code}`);
        continue;
      }

      const perMember = new Map<string, number>();
      const sends: Promise<void>[] = [];
      for (const s of (data ?? []) as Sub[]) {
        const count = perMember.get(s.member_id) ?? 0;
        if (count >= DEVICES_PER_MEMBER) continue;
        perMember.set(s.member_id, count + 1);
        sends.push(sendOne(db, active, s, messageFor(byMember.get(s.member_id) ?? [])));
      }
      await Promise.all(sends);
    }
  } catch {
    console.warn("[push] failed");
  }
}

/** One push per device per call. Its words are the reminder's only when
 *  every row is a reminder; anything a person did outranks it. */
function messageFor(rows: readonly Row[]): string {
  const row = rows.find((r) => r.type !== "sesh_reminder") ?? rows[0];
  return JSON.stringify(pushMessage(row));
}

async function sendOne(db: SupabaseClient, sender: PushSender, s: Sub, payload: string): Promise<void> {
  try {
    await sender.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, OPTIONS);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await db.from("push_subscriptions").delete().eq("id", s.id);
      return;
    }
    // Never the endpoint: it is a tracking handle.
    console.warn(`[push] not delivered: ${status ?? "no status"}`);
  }
}
