-- ---------------------------------------------------------------------------
-- Plan 03, ticket #6 — what the feed needs.
--
-- Two columns. One counts seats, one makes the seshes searchable.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The seat counter
--
-- "Spots left" is otherwise unbuildable. The RSVP read rule only shows
-- approved rows to approved guests, so a member deciding whether to ask
-- cannot count them — they have to be told a number.
--
-- It lands here, at zero, so the feed reads it from day one. The trigger that
-- keeps it in step with the rsvps table arrives with that table (#7), and the
-- capacity check reads it under the same row lock.
--
-- No write grant for `authenticated`. It is derived, like the fuzzy circle:
-- a host who could set it could say their sesh was full, or empty.
-- ---------------------------------------------------------------------------

alter table public.seshes add column approved_count integer not null default 0;

alter table public.seshes
  add constraint seshes_approved_count_nonnegative check (approved_count >= 0);

comment on column public.seshes.approved_count is
  'Derived. Maintained by the rsvps trigger; never written by a host.';

grant select (approved_count) on public.seshes to authenticated;

-- ---------------------------------------------------------------------------
-- Search
--
-- A stored generated tsvector with a GIN index, rather than pg_trgm and ILIKE.
-- It needs no extension and it is the same tool at ten rows and ten thousand.
--
-- English, so "blankets" finds "blanket" — a member should not have to guess
-- the plural. Only the three public columns feed it: the address is not
-- searchable, or the feed would become a way to test guesses against it.
--
-- to_tsvector with an explicit regconfig is IMMUTABLE, which a generated
-- column requires. The one-argument form is not, and would be rejected.
-- ---------------------------------------------------------------------------

alter table public.seshes
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(area_name, '')
    )
  ) stored;

comment on column public.seshes.search_vector is
  'Title, description and area name only. The address is never searchable.';

-- PostgREST needs SELECT on a column to filter by it, so the grant is what
-- makes textSearch work at all, not just what makes the column readable.
grant select (search_vector) on public.seshes to authenticated;

create index seshes_search_idx on public.seshes using gin (search_vector);

-- The feed's own query: open seshes that have not started, soonest first.
create index seshes_open_upcoming_idx on public.seshes (starts_at)
  where status = 'open';
