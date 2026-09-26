import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, floridaToday } from "@/lib/dates";
import { cardExpiryRung, guestCardLapsesBefore, type NotifyEvent } from "@/lib/notify/events";
import { notifyOnce } from "@/lib/notify/notify";

/**
 * The two clock-driven types (#55), run by the daily cron job with the admin
 * client. Nobody acts, so nobody else can write these rows.
 *
 * The job runs once a day at 10:00, so a "24-hour reminder" is in practice
 * "sometime in the 24 hours before". That is accepted: the free plan allows
 * two cron jobs and both are taken.
 *
 * Every row is written through notifyOnce(), so a second run the same day —
 * a retry, or somebody running scripts/run-cron.mjs by hand — writes nothing.
 * A failed read or write throws: the cron run should fail loudly, not
 * report zero.
 */

const DAY_MS = 86_400_000;
export const NOTIFICATION_RETENTION_DAYS = 90;

type Row = Record<string, unknown>;

function one(value: unknown): Row {
  return (Array.isArray(value) ? value[0] : value) as Row;
}

export async function runClockNotices(
  db: SupabaseClient,
  now: Date,
): Promise<{ reminders: number; cardNotices: number; hostNotices: number }> {
  return {
    reminders: await remindGuests(db, now),
    cardNotices: await warnCardHolders(db, floridaToday(now)),
    hostNotices: await warnHosts(db, now),
  };
}

/** Every approved guest of an open sesh that starts in the next 24 hours. */
async function remindGuests(db: SupabaseClient, now: Date): Promise<number> {
  const rows = await approvedRsvpsAhead(db, now, new Date(now.getTime() + DAY_MS), "");

  const bySesh = new Map<string, { hostId: string; startsAt: string; guestIds: string[] }>();
  for (const row of rows) {
    const sesh = one(row.sesh);
    const entry = bySesh.get(sesh.id as string) ?? { hostId: sesh.host_id as string, startsAt: sesh.starts_at as string, guestIds: [] };
    entry.guestIds.push(row.member_id as string);
    bySesh.set(sesh.id as string, entry);
  }

  const events: NotifyEvent[] = [...bySesh].map(([seshId, sesh]) => ({ kind: "sesh_reminder", seshId, ...sesh }));
  return notifyOnce(db, events);
}

/** Verified members whose card is on a rung of the ladder today. */
async function warnCardHolders(db: SupabaseClient, today: string): Promise<number> {
  const { data, error } = await db
    .from("profiles")
    .select("id, card_expires_on")
    .eq("status", "verified")
    .gte("card_expires_on", addDays(today, 1))
    .lte("card_expires_on", addDays(today, 7));
  if (error) throw new Error(`card ladder read failed: ${error.code}`);

  const events: NotifyEvent[] = [];
  for (const row of (data ?? []) as Row[]) {
    const cardExpiresOn = row.card_expires_on as string;
    const rung = cardExpiryRung(today, cardExpiresOn);
    if (rung) events.push({ kind: "card_expiry", memberId: row.id as string, cardExpiresOn, rung });
  }
  return notifyOnce(db, events);
}

/**
 * Spec §4.3: a host hears once when an approved guest's card lapses before
 * the sesh. The guest loses the address the day their card lapses, because
 * private.is_active_member gates the unlock — that is the auto-drop, and this
 * is what keeps it from being a surprise. The RSVP row itself stays approved;
 * freeing the seat is not part of #55, so the words promise only the address.
 *
 * PostgREST cannot compare two columns, so the date test runs here.
 */
async function warnHosts(db: SupabaseClient, now: Date): Promise<number> {
  const rows = await approvedRsvpsAhead(db, now, null, ", guest:profiles!inner(card_expires_on)");

  const events: NotifyEvent[] = [];
  for (const row of rows) {
    const sesh = one(row.sesh);
    const cardExpiresOn = one(row.guest).card_expires_on as string | null;
    if (!cardExpiresOn || !guestCardLapsesBefore(cardExpiresOn, sesh.starts_at as string)) continue;
    events.push({
      kind: "guest_card_expiry",
      seshId: sesh.id as string,
      hostId: sesh.host_id as string,
      guestId: row.member_id as string,
      cardExpiresOn,
    });
  }
  return notifyOnce(db, events);
}

const PAGE = 1000;

/**
 * Approved RSVPs on open seshes starting after now (and no later than
 * `until`, when given), with their sesh. Read a page at a time: PostgREST
 * caps a response at 1000 rows and would drop the rest without a word.
 */
async function approvedRsvpsAhead(db: SupabaseClient, now: Date, until: Date | null, extraColumns: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db
      .from("rsvps")
      .select(`id, member_id, sesh:seshes!inner(id, host_id, starts_at, status)${extraColumns}`)
      .eq("status", "approved")
      .eq("sesh.status", "open")
      .gt("sesh.starts_at", now.toISOString());
    if (until) query = query.lte("sesh.starts_at", until.toISOString());
    const { data, error } = await query.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`guest list read failed: ${error.code}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/**
 * Deletes notifications older than 90 days, so the table does not grow
 * without limit. Deleting is this function's job and nobody else's: a member
 * has no DELETE, because a member who could delete could erase the record of
 * a kick.
 */
export async function reapOldNotifications(db: SupabaseClient, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS).toISOString();
  const { count, error } = await db.from("notifications").delete({ count: "exact" }).lt("created_at", cutoff);
  if (error) throw new Error(`notification reaper failed: ${error.code}`);
  return count ?? 0;
}
