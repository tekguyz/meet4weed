-- ---------------------------------------------------------------------------
-- Plan 03, ticket #10 — the 7-day address wipe.
--
-- Twelve hours after a sesh the address becomes unreadable. That is a rule
-- about who may read it; the data is still sitting in the table. Over a year
-- of seshes that is a growing pile of members' home addresses with nothing
-- promised about it.
--
-- Seven days after a sesh starts, the street, the unit, the gate code and the
-- exact point are DELETED. The title, the times, the circle and the area name
-- stay, so a member keeps a history of where they went without the app
-- keeping where that was.
--
-- Seven days matches the card-image reaper in spec §4.2, so the app has one
-- retention story rather than two.
--
-- It does NOT get its own cron job: vercel.json already registers two and the
-- plan does not allow a third. It runs inside the existing daily expiry sweep,
-- alongside expiry_sweep(), which is not modified — that function has been
-- running against real members since Plan 02.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- First, keep the circle when the address goes.
--
-- seshes_set_fuzzy recomputes whenever exact_lat changes, and the wipe sets it
-- to null — which would hand fuzz_point a null and blank the published circle.
-- A sesh would then vanish off the map retrospectively, and a member's history
-- would lose the one part of the location they are allowed to keep.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_set_fuzzy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if tg_op = 'UPDATE' and new.exact_lat is null and old.fuzzy_lat is not null then
    -- The address has been wiped. Keep the circle: it is public already, and
    -- it is what a member's history is left with.
    new.fuzzy_lat := old.fuzzy_lat;
    new.fuzzy_lng := old.fuzzy_lng;
  elsif tg_op = 'INSERT'
     or new.exact_lat is distinct from old.exact_lat
     or new.exact_lng is distinct from old.exact_lng then
    select f.lat, f.lng into v_lat, v_lng from private.fuzz_point(new.exact_lat, new.exact_lng) f;
    new.fuzzy_lat := v_lat;
    new.fuzzy_lng := v_lng;
  else
    -- Editing a title must not move the circle: a circle that wobbles can be
    -- averaged. Putting the old values back also means a service_role write
    -- cannot set a fake circle by hand.
    new.fuzzy_lat := old.fuzzy_lat;
    new.fuzzy_lng := old.fuzzy_lng;
  end if;

  new.fuzzy_radius_m := 400;
  return new;
end;
$$;

revoke execute on function public.seshes_set_fuzzy() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The wipe
--
-- Only touches rows that still hold something, so a second run reports zero
-- rather than counting the same seshes again and turning the cron's own
-- report into noise.
-- ---------------------------------------------------------------------------

create or replace function public.sesh_address_reaper()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wiped integer;
begin
  with wiped as (
    update public.seshes
       set address_line = null,
           unit_note = null,
           gate_code = null,
           exact_lat = null,
           exact_lng = null
     where starts_at < now() - interval '7 days'
       and (address_line is not null or unit_note is not null or gate_code is not null or exact_lat is not null)
    returning 1
  )
  select count(*)::integer into v_wiped from wiped;

  return v_wiped;
end;
$$;

revoke execute on function public.sesh_address_reaper() from public, anon, authenticated;
grant execute on function public.sesh_address_reaper() to service_role;

comment on function public.sesh_address_reaper() is
  'Deletes the exact location of seshes more than 7 days past. Called from /api/cron/expiry-sweep.';
