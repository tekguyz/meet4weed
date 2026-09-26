import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhenAndWhere } from "@/lib/notify/events";

/**
 * The reads a sesh notification needs before it can be written: who hosts,
 * what it is called, whether it is still open, and who is coming.
 *
 * Each takes the client the caller already acts with. A member's own session
 * reads all of this for a sesh they host or just asked to join; the delete
 * path (#71) has only the service key. A failed read is logged by code and
 * returns nothing rather than throwing — the thing the notice reports has
 * already happened, and must not turn into an error on screen. The log is
 * what keeps a lost grant from silently telling nobody.
 */

export type SeshFacts = { hostId: string; title: string; status: "open" | "cancelled" };

const FACT_COLUMNS = "host_id, title, status";

function factsOf(row: Record<string, unknown>): SeshFacts {
  return { hostId: row.host_id as string, title: row.title as string, status: row.status as SeshFacts["status"] };
}

export async function readSeshFacts(db: SupabaseClient, seshId: string): Promise<SeshFacts | null> {
  const { data, error } = await db.from("seshes").select(FACT_COLUMNS).eq("id", seshId).maybeSingle();
  if (error) console.error(`[notify] sesh not read: ${error.code}`);
  return data ? factsOf(data) : null;
}

/** Everything a guest travels on, for comparing before and after an edit. */
export async function readTravelFacts(db: SupabaseClient, seshId: string): Promise<(SeshFacts & WhenAndWhere) | null> {
  const [{ data: sesh, error }, { data: address, error: addressError }] = await Promise.all([
    db.from("seshes").select(`${FACT_COLUMNS}, starts_at, materially_changed_at`).eq("id", seshId).maybeSingle(),
    // The address columns carry no SELECT grant. The host reads them through
    // the unlock function, the same way the edit screen does.
    db.rpc("sesh_address", { p_sesh: seshId }),
  ]);
  if (error) console.error(`[notify] sesh not read: ${error.code}`);
  if (addressError) console.error(`[notify] sesh address not read: ${addressError.code}`);
  if (!sesh) return null;

  const where = (address as Record<string, unknown>[] | null)?.[0];
  return {
    ...factsOf(sesh),
    startsAt: sesh.starts_at as string,
    materiallyChangedAt: (sesh.materially_changed_at as string | null) ?? null,
    addressLine: (where?.address_line as string | null) ?? null,
    unitNote: (where?.unit_note as string | null) ?? null,
    gateCode: (where?.gate_code as string | null) ?? null,
  };
}

/** The guests a sesh change reaches: approved ones only. Somebody still
 *  waiting on the host was never given the time or the address. */
export async function approvedGuestIds(db: SupabaseClient, seshId: string): Promise<string[]> {
  const { data, error } = await db.from("rsvps").select("member_id").eq("sesh_id", seshId).eq("status", "approved");
  if (error) console.error(`[notify] guest list not read: ${error.code}`);
  return (data ?? []).map((row) => row.member_id as string);
}

/** A member's own RSVP status on a sesh, or null when they have none. */
export async function readMyRsvpStatus(db: SupabaseClient, seshId: string, memberId: string): Promise<string | null> {
  const { data, error } = await db
    .from("rsvps")
    .select("status")
    .eq("sesh_id", seshId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) console.error(`[notify] rsvp not read: ${error.code}`);
  return (data?.status as string | undefined) ?? null;
}
