-- ---------------------------------------------------------------------------
-- Plan 04, ticket #30 — the unlisted door opens for somebody with a link.
--
-- 20260920150000 (#28) shut the door on an unlisted sesh: only somebody who
-- already holds a row may ask for a seat, and a `denied` row is not one. Its
-- own comment says what is missing — "the invite branch lands with invites
-- (#30)" — and this is that branch.
--
-- Without it, the headline sentence of this ticket is false. A member
-- redeems a link, lands on the unlisted sesh, presses "ask to come", and is
-- told the sesh is not taking requests, because a CLAIM is not an RSVP and
-- the door only knew how to read RSVPs. The link would let somebody LOOK at
-- a sesh they could never join.
--
-- private.has_invite_claim is exactly the right test and not a wider one: it
-- already returns false for a caller holding a `denied` or `kicked` RSVP, so
-- a link cannot be the way somebody walks back through a decision the host
-- already made. The #28 fix is not loosened — a denied member is refused by
-- the claim helper and by the row check, both.
--
-- Nothing about a LISTED sesh changes, because this whole branch sits behind
-- `visibility = 'unlisted'`. Every RSVP test from Plan 03 and every unlisted
-- test from #28 stays green, which is what makes them the regression net for
-- this file.
--
-- The refusal keeps M4W11 and the same wording as every other reason a sesh
-- is not taking requests. A member who is not coming does not need to be told
-- which, and telling them would turn this function into a way to test whether
-- an id exists.
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

  -- The unlisted door. Two ways through it and no others: a live row from
  -- before, or a claim on a link the host handed out. A `denied` row is
  -- neither — private.has_invite_claim refuses a denied caller as well, so a
  -- link is not a way around a decision the host already made.
  if v_sesh.visibility = 'unlisted'
     and (v_existing.id is null or v_existing.status = 'denied')
     and not private.has_invite_claim(p_sesh, v_caller) then
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
  'Asks for a seat. On an unlisted sesh the caller must already hold a live row or a claim on an invite; a denied row is neither.';
