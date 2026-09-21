-- ---------------------------------------------------------------------------
-- Plan 04, ticket #30 — the last unindexed foreign key.
--
-- invite_claims has three foreign keys and 20260921090000 indexed two of
-- them. The third is the COMPOSITE one, (invite_id, sesh_id) -> invites
-- (id, sesh_id), and it is the one that makes a claim's denormalised sesh_id
-- unable to drift from its invite's.
--
-- The primary key on (invite_id, member_id) leads with invite_id, so the
-- cascade already performs well and nothing was slow. But the repo rule is
-- "index every foreign key", and the Supabase database linter reads that the
-- same way Postgres does: an index serves a foreign key only when the key's
-- columns are a PREFIX of the index's. (invite_id, sesh_id) is not a prefix
-- of (invite_id, member_id), so the rule was not actually met.
--
-- The price is one more small index on a table that is emptied every seven
-- days by the reaper in #32.
-- ---------------------------------------------------------------------------

create index invite_claims_invite_sesh_idx on public.invite_claims (invite_id, sesh_id);
