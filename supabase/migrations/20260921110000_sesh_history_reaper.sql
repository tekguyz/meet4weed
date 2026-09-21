-- ---------------------------------------------------------------------------
-- Plan 04, ticket #32 — the app forgets the rest of it.
--
-- Seven days after a sesh the address is already deleted (#10). What that run
-- left behind is a per-member record of what named people brought to a named
-- person's home, and a permanent edge saying this member was invited to that
-- member's home on that date. Both outlive the reason they existed.
--
-- This extends THE SAME FUNCTION, in THE SAME RUN, to take three more things
-- with it:
--
--   * contributions  — the bring list,
--   * invites        — the links a host handed out,
--   * invite_claims  — who walked through one.
--
-- The sesh's title, start time and area name survive, so a member keeps a
-- history of where they went without the app keeping who was in the room.
--
-- ONE JOB, ONE SCHEDULE, ONE RETENTION STORY. It is not a second cron entry:
-- sesh_address_reaper() already rides inside the daily expiry sweep, and
-- vercel.json is not touched. Seven days matches the card-image reaper in
-- spec §4.2 and the address wipe, so the app still has one number to explain.
--
-- NOTHING MEMBER-FACING GAINED A DELETE. The reaper is the only thing that
-- deletes on this schedule.
--
-- THE FUNCTION KEEPS THE NAME sesh_address_reaper(), and this file does not.
-- The name is now narrower than the job, and that is deliberate: the name is
-- the call site in app/api/cron/expiry-sweep/route.ts and the RPC name in the
-- shipped tests, and renaming it would mean a drop, a re-grant and a window
-- where the cron calls a function that is not there. The comment below says
-- what it really does, and this file is named after the job.
-- ---------------------------------------------------------------------------

create or replace function public.sesh_address_reaper()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wiped integer;
  v_cutoff timestamptz := now() - interval '7 days';
begin
  -- The address. Only touches rows that still hold something, so a second run
  -- reports zero rather than counting the same seshes again and turning the
  -- cron's own report into noise.
  with wiped as (
    update public.seshes
       set address_line = null,
           unit_note = null,
           gate_code = null,
           exact_lat = null,
           exact_lng = null
     where starts_at < v_cutoff
       and (address_line is not null or unit_note is not null or gate_code is not null or exact_lat is not null)
    returning 1
  )
  select count(*)::integer into v_wiped from wiped;

  -- The history. A SEPARATE pass over the same cut-off, deliberately not
  -- joined to the update above: a sesh whose address an earlier run already
  -- took must still lose its bring list and its links. Each delete is
  -- idempotent, so a second run in the same day finds nothing.
  --
  -- Claims before invites. The composite foreign key would cascade them
  -- anyway, but a row this app promises to forget is deleted where somebody
  -- reading this can see it happen.
  delete from public.invite_claims c
   using public.seshes s
   where c.sesh_id = s.id
     and s.starts_at < v_cutoff;

  delete from public.invites i
   using public.seshes s
   where i.sesh_id = s.id
     and s.starts_at < v_cutoff;

  delete from public.contributions c
   using public.seshes s
   where c.sesh_id = s.id
     and s.starts_at < v_cutoff;

  -- The count stays "seshes whose address was wiped", unchanged from #10, so
  -- the cron's existing report keeps meaning what it has always meant.
  return v_wiped;
end;
$$;

revoke execute on function public.sesh_address_reaper() from public, anon, authenticated;
grant execute on function public.sesh_address_reaper() to service_role;

comment on function public.sesh_address_reaper() is
  'Seven days after a sesh: deletes its exact location, its bring list, its invites and its invite claims. Title, times and area name survive. Called from /api/cron/expiry-sweep.';
