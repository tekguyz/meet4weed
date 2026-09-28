import { createClient } from "@/lib/supabase/server";

export type BlockedMember = {
  memberId: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  blockedAt: string;
};

/** Me -> Blocked (issue #112). The profiles policy hides a blocked member, so
 *  this reads through public.my_blocks(), which returns only the caller's own
 *  blocks, newest first, and only the columns a row shows.
 *
 *  An error throws to the error boundary. An empty list here would say "You
 *  haven't blocked anyone", which is false on a safety screen. */
export async function getMyBlocks(): Promise<BlockedMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_blocks");
  if (error) throw new Error("Could not load blocked members.");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    memberId: row.member_id as string,
    handle: row.handle as string,
    displayName: (row.display_name as string | null) ?? null,
    avatarSeed: (row.avatar_seed as string | null) ?? null,
    blockedAt: row.blocked_at as string,
  }));
}
