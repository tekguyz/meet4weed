-- ---------------------------------------------------------------------------
-- Plan 04, ticket #28 — the unlisted door, tightened.
--
-- 20260920140000 shut the door on a stranger: on an unlisted sesh, only
-- somebody who already holds a row may ask for a seat. That left one person
-- on the wrong side of it.
--
-- A host denies somebody on a listed sesh, then unlists it. The denial took
-- the sesh out of private.has_rsvp — it counts `approved` and `requested`,
-- not `denied` — so the denied member cannot read it any more. But they still
-- hold a ROW, so the door let them ask again, which set their status back to
-- `requested`, which handed the read straight back. The host would have had
-- no way to stop it and no way to know.
--
-- On a LISTED sesh this does not arise: a denied member can already read it
-- through the public branch, so re-asking gains them nothing. Unlisted is
-- where the row becomes the only way in, and that is where it has to be shut.
--
-- The ticket's own sentence is the test: "readable only by its host and by
-- anyone holding a live RSVP on it". A denied member does not hold a live
-- RSVP. Asking again must not be how they mint one.
--
-- `cancelled` is deliberately still let through. Somebody who withdrew chose
-- to leave; the host never refused them, and they were on the guest list when
-- the sesh was made private.
--
-- `kicked` is refused before this ever runs, with M4W13, exactly as before.
--
-- Nothing else in the function changes, and nothing about a listed sesh
-- changes, so every RSVP test from Plan 03 stays green.
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

  -- The unlisted door. A row is the only way in, and a denied row is not one:
  -- see the block above this function. Same code and same wording as every
  -- other reason, so this cannot be used to test whether an id exists.
  if v_sesh.visibility = 'unlisted'
     and (v_existing.id is null or v_existing.status = 'denied') then
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
  'Asks for a seat. On an unlisted sesh the caller must already hold a row, and a denied row is not one. The invite branch arrives with invites (#30).';
