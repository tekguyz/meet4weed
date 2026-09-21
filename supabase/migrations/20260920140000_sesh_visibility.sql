-- ---------------------------------------------------------------------------
-- Plan 04, ticket #28 — a sesh can be unlisted.
--
-- A host runs something small without posting it to the whole app. An
-- unlisted sesh is absent from the feed, the map and search, and is readable
-- only by its host and by anyone already holding a live RSVP on it.
--
-- The exclusion happens IN THE POLICY, not in the queries. lib/sesh/queries.ts
-- keeps the same `where` clauses it had before this migration: the feed, the
-- map and the search cannot get this wrong, because none of the three knows
-- the rule exists. One place holds it.
--
-- Every existing row is `listed`, and `listed` behaves exactly as a sesh
-- behaved before. That is why every sesh-visibility test from Plan 03 is left
-- unedited and kept as the regression net for this migration.
--
-- This migration ships the policy with its HOST and RSVP branches only. The
-- invite-claim branch needs invites and arrives with them (#30) — the same
-- shape as #4, which shipped the address unlock with only its host branch.
-- ---------------------------------------------------------------------------

create type public.sesh_visibility as enum ('listed', 'unlisted');

-- `not null default 'listed'` is what makes the migration additive: every row
-- that already exists is listed, and nothing about it changes.
alter table public.seshes
  add column visibility public.sesh_visibility not null default 'listed';

comment on column public.seshes.visibility is
  'listed: in the feed, the map and search. unlisted: readable only by the host and by anyone holding a live RSVP. Enforced by seshes_select, never by a query.';

-- ---------------------------------------------------------------------------
-- Privileges
--
-- A host picks this when posting and can flip it afterwards, so `authenticated`
-- holds SELECT, INSERT and UPDATE on the one column. It is not derived and
-- there is nothing to protect: a host choosing who can find their own sesh is
-- the whole feature.
--
-- SELECT matters as much as the other two. Without it a host's own edit screen
-- could not read back what it is about to submit, and PostgREST could not
-- return the column at all.
-- ---------------------------------------------------------------------------

grant select (visibility) on public.seshes to authenticated;
grant insert (visibility) on public.seshes to authenticated;
grant update (visibility) on public.seshes to authenticated;

-- "Automatically expose new tables" is OFF. A table-level ALL covers columns
-- added later, so the grant #4 already made covers `visibility` too and this
-- line changes nothing. It is here so that this file, read on its own, says
-- what service_role holds rather than sending the reader to another one.
grant all on public.seshes to service_role;

-- ---------------------------------------------------------------------------
-- Index
--
-- `visibility` is a column the policy reads, so the repo rule says index it.
-- A standalone btree on a two-value enum would never be chosen by the planner,
-- so the column is indexed in the SHAPE the policy reads it: the public branch
-- is `visibility = 'listed' and status = 'open'`, and the feed orders by
-- starts_at inside exactly that set.
--
-- seshes_open_upcoming_idx (#6) is left in place and is what the feed will
-- usually get: a host's own unlisted rows also satisfy the policy, so the
-- planner cannot prove the feed's rows all sit inside this narrower index.
-- This one is here to keep the rule — index every column a policy reads —
-- honest, and it is the index the public branch would want if the planner
-- ever can use it. Two partial indexes on a small table is the price.
-- ---------------------------------------------------------------------------

create index seshes_listed_open_upcoming_idx on public.seshes (starts_at)
  where visibility = 'listed' and status = 'open';

-- ---------------------------------------------------------------------------
-- The read rule
--
-- Three branches, and only the third one is touched. Host and RSVP are left
-- exactly as #8 wrote them, which is why an unlisted sesh stays readable to
-- the people already in it: unlisting evicts nobody, and re-listing admits
-- nobody who was not already there.
-- ---------------------------------------------------------------------------

drop policy seshes_select on public.seshes;

create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      -- A host always sees their own.
      host_id = (select auth.uid())
      -- Anybody holding a seat keeps seeing it, cancelled or not, listed or
      -- not, and whether or not the host's card has lapsed.
      or private.has_rsvp(id, (select auth.uid()))
      -- The public feed. This is the only branch an unlisted sesh fails, and
      -- it is the only branch that puts a sesh in front of a stranger.
      or (
        visibility = 'listed'
        and status = 'open'
        and private.is_active_member(host_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- The door, not just the window
--
-- private.has_rsvp is a read branch, so anyone who can MAKE an RSVP can read
-- an unlisted sesh. public.request_rsvp is SECURITY DEFINER and reads
-- public.seshes directly, which means it does not go through the policy above
-- — a member who learned an id could otherwise mint themselves a `requested`
-- row and read the sesh through their own request. Unlisted would then be
-- obscurity rather than a rule.
--
-- So: on an unlisted sesh, only somebody who ALREADY has a row may ask. That
-- covers a guest who withdrew or was denied and wants back in. The branch for
-- somebody arriving with an invite lands with invites (#30).
--
-- The refusal reuses M4W11 with the same wording as every other reason a sesh
-- is not taking requests. A member who is not coming does not need to be told
-- which reason, and telling them would turn this function into a way to test
-- whether an id exists.
-- ---------------------------------------------------------------------------

create or replace function public.request_rsvp(p_sesh uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_sesh public.seshes;
  v_existing public.rsvps;
  v_today_start timestamptz;
  v_today integer;
begin
  if not private.is_active_member(v_caller) then
    raise exception 'card is not current' using errcode = 'M4W10';
  end if;

  select * into v_sesh from public.seshes where id = p_sesh;

  -- One message for every reason a sesh is not taking requests. A member who
  -- is not coming does not need to be told which.
  if v_sesh.id is null
     or v_sesh.status <> 'open'
     or v_sesh.starts_at <= now()
     or not private.is_active_member(v_sesh.host_id) then
    raise exception 'sesh is not taking requests' using errcode = 'M4W11';
  end if;

  if v_sesh.host_id = v_caller then
    raise exception 'a host is not a guest' using errcode = 'M4W12';
  end if;

  select * into v_existing from public.rsvps where sesh_id = p_sesh and member_id = v_caller;

  if v_existing.status = 'kicked' then
    raise exception 'removed by the host' using errcode = 'M4W13';
  end if;

  -- The unlisted door. See the block above this function.
  if v_sesh.visibility = 'unlisted' and v_existing.id is null then
    raise exception 'sesh is not taking requests' using errcode = 'M4W11';
  end if;

  -- Florida midnight, not UTC midnight: the cap is a day as a member lives it.
  v_today_start := (private.florida_today())::timestamp at time zone 'America/New_York';
  select count(*) into v_today
    from public.rsvps
   where member_id = v_caller and requested_at >= v_today_start;

  if v_today >= 20 then
    raise exception 'too many requests today' using errcode = 'M4W17';
  end if;

  if v_existing.id is null then
    insert into public.rsvps (sesh_id, member_id, status, requested_at)
    values (p_sesh, v_caller, 'requested', now());
  else
    update public.rsvps
       set status = 'requested', requested_at = now(), decided_at = null
     where id = v_existing.id;
  end if;
end;
$$;

-- CREATE OR REPLACE keeps the old grants, so these are a re-statement. They
-- are written out anyway: a function whose EXECUTE grants you have to go and
-- look up in another file is a function somebody will get wrong.
revoke execute on function public.request_rsvp(uuid) from public, anon;
grant execute on function public.request_rsvp(uuid) to authenticated;

comment on function public.request_rsvp(uuid) is
  'Asks for a seat. Refuses an unlisted sesh unless the caller already holds a row on it; the invite branch arrives with invites (#30).';
