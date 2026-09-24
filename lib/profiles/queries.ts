import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PublicProfile } from "@/lib/profiles/schema";

const COLUMNS =
  "id, handle, display_name, bio, city, avatar_url, avatar_seed, strain_prefs, method_prefs, vibe_tags, status, card_expires_on, attested_at";

const PUBLIC_COLUMNS =
  "id, handle, display_name, bio, city, avatar_url, avatar_seed, strain_prefs, method_prefs, vibe_tags, status";

/** Mirrors profiles_handle_format. */
const HANDLE_FORMAT = /^[a-z0-9_]{3,20}$/;

type Row = Record<string, unknown>;

function toProfile(row: Row): Profile {
  return {
    id: row.id as string,
    handle: row.handle as string,
    displayName: (row.display_name as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    avatarSeed: (row.avatar_seed as string | null) ?? null,
    strainPrefs: (row.strain_prefs as string[]) ?? [],
    methodPrefs: (row.method_prefs as string[]) ?? [],
    vibeTags: (row.vibe_tags as string[]) ?? [],
    status: row.status as Profile["status"],
    cardExpiresOn: (row.card_expires_on as string | null) ?? null,
    attestedAt: (row.attested_at as string | null) ?? null,
  };
}

/** Cached per request: the Frame's layout and the page under it both ask. */
export const getMyProfile = cache(async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select(COLUMNS).eq("id", user.id).maybeSingle();
  return data ? toProfile(data) : null;
});

/** Selects the public column list rather than trimming a full row, so the card
 *  fields never travel to the caller in the first place.
 *
 *  Null for a handle that does not exist AND for one the caller may not read —
 *  the profiles select policy returns no row for both, and callers must not
 *  try to tell them apart. */
export async function getProfileByHandle(handle: string): Promise<PublicProfile | null> {
  // Anything that could never be a handle is not worth a round trip.
  if (!HANDLE_FORMAT.test(handle.toLowerCase())) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PUBLIC_COLUMNS)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!data) return null;

  const row = data as Row;
  return {
    id: row.id as string,
    handle: row.handle as string,
    displayName: (row.display_name as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    avatarSeed: (row.avatar_seed as string | null) ?? null,
    strainPrefs: (row.strain_prefs as string[]) ?? [],
    methodPrefs: (row.method_prefs as string[]) ?? [],
    vibeTags: (row.vibe_tags as string[]) ?? [],
    status: row.status as Profile["status"],
  };
}
