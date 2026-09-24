-- Meet4Weed — which terms a member agreed to (issue #68)
--
-- Attestation writes this in the same UPDATE as attested_at
-- (app/onboarding/actions.ts), so no member is attested without a record of
-- the text they agreed to. The current version is one constant in code,
-- lib/legal/terms.ts. v1 only records it; nothing forces a re-accept.
--
-- Nullable with no default: members who attested before this migration have
-- no record, and inventing one would claim an agreement nobody made. Adding a
-- nullable column with no default rewrites no rows.
--
-- The length check keeps the column a label, not a place to store text.

alter table public.profiles
  add column terms_version text
  constraint profiles_terms_version_length check (char_length(terms_version) between 1 and 40);

-- Granted beside attested_at, for the same reason: attestation is a
-- self-declaration, and the server action records it with the member's own
-- session. The UPDATE policy still limits a member to their own row.
--
-- SELECT is a table-level grant in 20260916082218_profiles.sql and covers the
-- new column. service_role holds `grant all` on the table, which covers it too.
grant update (terms_version) on public.profiles to authenticated;
