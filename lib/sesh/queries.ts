import { createClient } from "@/lib/supabase/server";
import type { SeshStatus, SeshType } from "@/lib/sesh/schema";

/** Named columns, never `select *`.
 *
 *  In lib/profiles/queries.ts this is a habit. Here it is load-bearing:
 *  `authenticated` holds no SELECT grant on the address columns, and a
 *  wildcard names every column on the table, so `*` does not quietly trim the
 *  private ones — it fails the whole query with 42501. Proved in
 *  supabase/tests/__tests__/sesh-rls.test.ts. */
const LIST_COLUMNS =
  "id, host_id, title, description, sesh_type, starts_at, capacity, status, fuzzy_lat, fuzzy_lng, fuzzy_radius_m";

export type SeshListItem = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  seshType: SeshType;
  startsAt: string;
  capacity: number;
  status: SeshStatus;
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
