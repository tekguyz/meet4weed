import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/notify/events";
import type { FeedItem } from "@/lib/notify/feed";

/** Enough to scroll a busy week. Older rows wait for the reaper (#55). */
export const FEED_LIMIT = 50;

/** The sesh and the actor are looked up live, through the reader's own RLS, so
 *  a handle change or a title edit shows at once. The actor FK is named: the
 *  table points at profiles twice. */
export const FEED_COLUMNS =
  "id, type, sesh_id, payload, read_at, created_at, sesh:seshes(title), actor:profiles!notifications_actor_id_fkey(handle)";

type Row = Record<string, unknown>;

function one(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return (value as Row | null) ?? null;
}

function toFeedItem(row: Row): FeedItem {
  return {
    id: row.id as string,
    type: row.type as NotificationType,
    seshId: (row.sesh_id as string | null) ?? null,
    seshTitle: (one(row.sesh)?.title as string | undefined) ?? null,
    actorHandle: (one(row.actor)?.handle as string | undefined) ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** The signed-in member's feed, newest first. The select policy already limits
 *  it to their own rows; no rows is simply an empty feed, not an error. */
export async function listMyFeed(): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select(FEED_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);

  return ((data ?? []) as Row[]).map(toFeedItem);
}

/** How many of the member's rows are unread. A head request: no rows travel. */
export async function myUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return count ?? 0;
}
