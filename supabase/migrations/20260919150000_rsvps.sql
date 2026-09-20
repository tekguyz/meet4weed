-- ---------------------------------------------------------------------------
-- Plan 03, ticket #7 — RSVPs.
--
-- People ask to come; hosts decide. Two things here are load-bearing:
--
--   1. `authenticated` gets SELECT on this table and nothing else. Every write
--      goes through a function. The status column IS the security story — a
--      member who can name it can approve themselves — and a column-level
--      grant cannot express "you may set requested but not approved".
--
--   2. decide_rsvp takes the SESH row with FOR UPDATE before it counts seats.
--      That lock is what makes capacity a real number instead of a suggestion:
--      two approvals of the last seat serialise, and the second one sees the
--      true count and is refused.
--
-- Nothing here unlocks the address. The guest branch of can_see_address is
-- #8, deliberately on its own.
-- ---------------------------------------------------------------------------

create type public.rsvp_status as enum (
  'requested',
  'approved',
  'denied',
  'cancelled',
  'kicked'
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  sesh_id uuid not null references public.seshes (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'requested',

  -- Stamped every time somebody asks, including asking again after a denial.
  -- created_at cannot carry the daily cap, because a re-request is an UPDATE
  -- and would never move it — a denied member could ask a thousand times.
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rsvps_one_per_member unique (sesh_id, member_id)
);

comment on table public.rsvps is
  'One row per member per sesh. Written only through request_rsvp, cancel_rsvp and decide_rsvp.';

-- SELECT only. No insert, no update, no delete — see the header.
grant select on public.rsvps to authenticated;
grant all on public.rsvps to service_role;

create index rsvps_sesh_id_idx on public.rsvps (sesh_id);
create index rsvps_member_id_idx on public.rsvps (member_id);
create index rsvps_sesh_status_idx on public.rsvps (sesh_id, status);
-- Serves the daily cap count.
create index rsvps_member_requested_idx on public.rsvps (member_id, requested_at);

-- ---------------------------------------------------------------------------
-- Policy helpers
--
-- Both are SECURITY DEFINER because they are read from inside a policy on the
-- very table they query. Without that, the guest-list branch would recurse.
-- ---------------------------------------------------------------------------

create or replace function private.is_host(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.seshes s where s.id = p_sesh and s.host_id = p_user);
$$;

revoke execute on function private.is_host(uuid, uuid) from public, anon;
grant execute on function private.is_host(uuid, uuid) to authenticated, service_role;

create or replace function private.is_approved_guest(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rsvps r
    where r.sesh_id = p_sesh and r.member_id = p_user and r.status = 'approved'
  );
$$;

revoke execute on function private.is_approved_guest(uuid, uuid) from public, anon;
grant execute on function private.is_approved_guest(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. Enabled, never forced.
-- ---------------------------------------------------------------------------

alter table public.rsvps enable row level security;

-- A member sees their own row. A host sees every row on their own sesh.
-- An approved guest sees the other approved guests — and only them, so that
-- asking to join every sesh does not become a way to read the membership.
create policy rsvps_select on public.rsvps
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      member_id = (select auth.uid())
      or private.is_host(sesh_id, (select auth.uid()))
      or (status = 'approved' and private.is_approved_guest(sesh_id, (select auth.uid())))
    )
  );

-- ---------------------------------------------------------------------------
-- The seat counter
--
-- Recomputed from scratch rather than nudged by one. At this scale the count
-- is free, and a counter that drifts would eventually let a sesh overfill —
-- which is the one number this whole ticket exists to keep honest.
-- ---------------------------------------------------------------------------

create or replace function public.rsvps_sync_approved_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesh uuid := coalesce(new.sesh_id, old.sesh_id);
begin
  update public.seshes s
     set approved_count = (
       select count(*) from public.rsvps r where r.sesh_id = v_sesh and r.status = 'approved'
     )
   where s.id = v_sesh;
  return null;
end;
$$;

revoke execute on function public.rsvps_sync_approved_count() from public, anon, authenticated;

create trigger rsvps_sync_approved_count
  after insert or update or delete on public.rsvps
  for each row execute function public.rsvps_sync_approved_count();

create trigger rsvps_touch_updated_at
  before update on public.rsvps
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- A host cannot shrink a sesh below the people already in it
--
-- A trigger rather than a policy check, so the refusal carries its own
-- SQLSTATE and the screen can say how many are already approved. An RLS
-- refusal would arrive as 42501, indistinguishable from every other reason a
-- write can bounce.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_guard_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.capacity < new.approved_count then
    raise exception 'capacity below approved count' using errcode = 'M4W16';
  end if;
  return new;
end;
$$;

revoke execute on function public.seshes_guard_capacity() from public, anon, authenticated;

create trigger seshes_guard_capacity
  before update on public.seshes
  for each row execute function public.seshes_guard_capacity();

-- ---------------------------------------------------------------------------
-- Asking
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

revoke execute on function public.request_rsvp(uuid) from public, anon;
grant execute on function public.request_rsvp(uuid) to authenticated;

create or replace function public.cancel_rsvp(p_sesh uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  update public.rsvps
     set status = 'cancelled', decided_at = now()
   where sesh_id = p_sesh
     and member_id = v_caller
     and status in ('requested', 'approved');

  if not found then
    raise exception 'nothing to withdraw' using errcode = 'M4W15';
  end if;
end;
$$;

revoke execute on function public.cancel_rsvp(uuid) from public, anon;
grant execute on function public.cancel_rsvp(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------

create or replace function public.decide_rsvp(p_rsvp uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_rsvp public.rsvps;
  v_sesh public.seshes;
  v_taken integer;
begin
  if p_decision not in ('approved', 'denied', 'kicked') then
    raise exception 'unknown decision' using errcode = 'M4W15';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp;
  if v_rsvp.id is null then
    raise exception 'no such request' using errcode = 'M4W15';
  end if;

  -- THE LOCK. Taken before the seat count, so two approvals of the last seat
  -- serialise: the second waits here, then counts, and sees the truth.
  select * into v_sesh from public.seshes where id = v_rsvp.sesh_id for update;

  if v_sesh.host_id is distinct from v_caller or not private.is_active_member(v_caller) then
    raise exception 'not the host' using errcode = 'M4W15';
  end if;

  if v_sesh.status <> 'open' then
    raise exception 'sesh is closed' using errcode = 'M4W11';
  end if;

  if p_decision = 'approved' then
    -- Excludes this row, so re-approving somebody already approved does not
    -- count them twice.
    select count(*) into v_taken
      from public.rsvps
     where sesh_id = v_sesh.id and status = 'approved' and id <> p_rsvp;

    if v_taken >= v_sesh.capacity then
      raise exception 'sesh is full' using errcode = 'M4W14';
    end if;
  end if;

  update public.rsvps
     set status = p_decision::public.rsvp_status, decided_at = now()
   where id = p_rsvp;
end;
$$;

revoke execute on function public.decide_rsvp(uuid, text) from public, anon;
grant execute on function public.decide_rsvp(uuid, text) to authenticated;
