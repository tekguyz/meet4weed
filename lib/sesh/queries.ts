import { createClient } from "@/lib/supabase/server";
import type { SeshStatus, SeshType } from "@/lib/sesh/schema";
import { FEED_PAGE_SIZE, MAP_LIMIT, type FeedFilters } from "@/lib/sesh/feed-filters";

/** Named columns, never `select *`.
 *
 *  In lib/profiles/queries.ts this is a habit. Here it is load-bearing:
 *  `authenticated` holds no SELECT grant on the address columns, and a
 *  wildcard names every column on the table, so `*` does not quietly trim the
 *  private ones — it fails the whole query with 42501. Proved in
 *  supabase/tests/__tests__/sesh-rls.test.ts. */
const LIST_COLUMNS =
  "id, host_id, title, description, sesh_type, starts_at, capacity, status, area_name, approved_count, fuzzy_lat, fuzzy_lng, fuzzy_radius_m";

export type SeshListItem = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  seshType: SeshType;
  startsAt: string;
  capacity: number;
  status: SeshStatus;
  areaName: string | null;
  approvedCount: number;
  fuzzyLat: number | null;
  fuzzyLng: number | null;
  fuzzyRadiusM: number;
};

type Row = Record<string, unknown>;

function toListItem(row: Row): SeshListItem {
  return {
    id: row.id as string,
    hostId: row.host_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    seshType: row.sesh_type as SeshType,
    startsAt: row.starts_at as string,
    capacity: row.capacity as number,
    status: row.status as SeshStatus,
    areaName: (row.area_name as string | null) ?? null,
    approvedCount: (row.approved_count as number | null) ?? 0,
    fuzzyLat: (row.fuzzy_lat as number | null) ?? null,
    fuzzyLng: (row.fuzzy_lng as number | null) ?? null,
    fuzzyRadiusM: row.fuzzy_radius_m as number,
  };
}

/** What the signed-in member is hosting, soonest first. The select policy
 *  already limits this to their own rows; the filter is for the index. */
export async function listMySeshes(): Promise<SeshListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("seshes")
    .select(LIST_COLUMNS)
    .eq("host_id", user.id)
    .order("starts_at", { ascending: true });

  return (data ?? []).map(toListItem);
}

/** One sesh the caller hosts, for the edit screen. The address is fetched
 *  separately through sesh_address(): it is not on the table as far as
 *  `authenticated` is concerned, and naming it here would fail the whole
 *  query with 42501. */
export async function getMySesh(id: string): Promise<SeshListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("seshes").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  return data ? toListItem(data as Row) : null;
}

export type SeshAddress = {
  addressLine: string | null;
  unitNote: string | null;
  gateCode: string | null;
  exactLat: number | null;
  exactLng: number | null;
};

/** The only way to read an address. Returns null when the caller may not —
 *  an empty result is the locked state, not an error, and the screen renders
 *  from that rather than deciding anything itself. */
export async function getSeshAddress(seshId: string): Promise<SeshAddress | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sesh_address", { p_sesh: seshId });
  const row = (data as Row[] | null)?.[0];
  if (!row) return null;

  return {
    addressLine: (row.address_line as string | null) ?? null,
    unitNote: (row.unit_note as string | null) ?? null,
    gateCode: (row.gate_code as string | null) ?? null,
    exactLat: (row.exact_lat as number | null) ?? null,
    exactLng: (row.exact_lng as number | null) ?? null,
  };
}

/** The public feed: open seshes that have not started yet, soonest first.
 *
 *  Cancelled seshes and finished ones are filtered here. A sesh whose host's
 *  card has lapsed is filtered by the select policy instead — that is a rule,
 *  not a preference, so it belongs in the database.
 *
 *  One extra row is fetched beyond the page so the caller knows whether there
 *  is a next page without a second count query. */
export async function listFeed(filters: FeedFilters): Promise<{ seshes: SeshListItem[]; hasMore: boolean }> {
  const supabase = await createClient();

  const limit = filters.view === "map" ? MAP_LIMIT : FEED_PAGE_SIZE;
  const offset = filters.view === "map" ? 0 : (filters.page - 1) * FEED_PAGE_SIZE;

  let query = supabase
    .from("seshes")
    .select(LIST_COLUMNS)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit);

  if (filters.types.length) query = query.in("sesh_type", filters.types);
  if (filters.search) {
    query = query.textSearch("search_vector", filters.search, { type: "websearch", config: "english" });
  }

  const { data } = await query;
  const rows = (data ?? []) as Row[];
  return { seshes: rows.slice(0, limit).map(toListItem), hasMore: rows.length > limit };
}

/** One sesh, for its own page. The select policy decides whether the caller
 *  gets it at all. */
export async function getSesh(id: string): Promise<SeshListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("seshes").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  return data ? toListItem(data as Row) : null;
}

export type RsvpStatus = "requested" | "approved" | "denied" | "cancelled" | "kicked";

export type RsvpRow = {
  id: string;
  memberId: string;
  status: RsvpStatus;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

const RSVP_COLUMNS =
  "id, member_id, status, requested_at, profiles(handle, display_name, avatar_url, bio)";

function toRsvp(row: Row): RsvpRow {
  const profile = (row.profiles ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    memberId: row.member_id as string,
    status: row.status as RsvpStatus,
    handle: (profile.handle as string) ?? "unknown",
    displayName: (profile.display_name as string | null) ?? null,
    avatarUrl: (profile.avatar_url as string | null) ?? null,
    bio: (profile.bio as string | null) ?? null,
  };
}

/** Whatever the caller is allowed to see: their own row, everything if they
 *  host it, or the approved guests if they are one. The policy does the
 *  deciding — this asks for all of it and takes what comes back. */
export async function listRsvps(seshId: string): Promise<RsvpRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rsvps")
    .select(RSVP_COLUMNS)
    .eq("sesh_id", seshId)
    .order("requested_at", { ascending: true });
  return (data ?? []).map((row) => toRsvp(row as Row));
}

/** The seshes the caller has asked about or is going to. */
export async function listMyGoing(): Promise<{ sesh: SeshListItem; status: RsvpStatus }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("rsvps")
    .select(`status, seshes(${LIST_COLUMNS})`)
    .eq("member_id", user.id)
    .in("status", ["requested", "approved"]);

  return (data ?? [])
    .map((row) => {
      const sesh = (row as Row).seshes as Row | null;
      return sesh ? { sesh: toListItem(sesh), status: (row as Row).status as RsvpStatus } : null;
    })
    .filter((row): row is { sesh: SeshListItem; status: RsvpStatus } => row !== null)
    .sort((a, b) => a.sesh.startsAt.localeCompare(b.sesh.startsAt));
}

/** How many people are waiting on each of the caller's own seshes. The host
 *  badge — the only way a host learns of a request in this plan. */
export async function pendingCounts(seshIds: string[]): Promise<Record<string, number>> {
  if (!seshIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("rsvps").select("sesh_id").in("sesh_id", seshIds).eq("status", "requested");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[(row as Row).sesh_id as string] = (counts[(row as Row).sesh_id as string] ?? 0) + 1;
  return counts;
}
