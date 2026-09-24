-- Meet4Weed — the Avatar's seed (issue #69)
--
-- The Avatar is a generated mark, never a photo. components/member/avatar.tsx
-- draws it from this seed. Shuffle in settings writes a new random one.
--
-- Nullable with no default: null means "derive from the member id", so no
-- profile is ever blank and no row needs a backfill. Adding a nullable column
-- with no default rewrites no rows.
--
-- avatar_url stays in the schema, unused, for the v2 photo avatar.
--
-- The length check keeps the column a seed, not a place to store text.
-- Mirrors AVATAR_SEED_MAX in lib/profiles/avatar.ts.

alter table public.profiles
  add column avatar_seed text
  constraint profiles_avatar_seed_length check (char_length(avatar_seed) between 1 and 40);

-- The member picks their own mark, so the member's own session writes it. The
-- UPDATE policy still limits a member to their own row.
--
-- SELECT is a table-level grant in 20260916082218_profiles.sql and covers the
-- new column, so other members can draw it. service_role holds `grant all` on
-- the table, which covers it too.
grant update (avatar_seed) on public.profiles to authenticated;
