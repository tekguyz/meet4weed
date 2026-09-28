-- Meet4Weed — the block wall (issue #111, Plan 06 step 1 of 7)
--
-- A block is a TWO-WAY wall (CONTEXT.md, Block). Once either member has
-- blocked the other:
--
--   - neither reads the other's profile,
--   - neither reads a sesh the other hosts,
--   - neither can ask to join the other's sesh, by asking or by invite link,
--   - neither reads the other's exact location by any route.
--
-- The blocked member is never told. Every refusal below is the same error a
-- member gets for a sesh they cannot see (M4W11, M4W19) and the same empty
-- result a missing profile gives. No error says "blocked".
--
-- ONE HELPER, private.is_blocked_between(a, b). Every place the wall applies
-- calls it, so one grep finds the whole wall — the same rule as
-- private.same_realm.
--
-- THE WALL DOES NOT REACH INTO A THIRD MEMBER'S SESH. Both still show on that
-- guest list, so a member knows who will be in the room. The rsvps policy has
-- no wall in it at all, and the profiles policy lets a handle through when
-- the two share an approved seat at a third member's sesh
-- (private.in_same_room). Without that exception the guest list would read
-- "@unknown", because it joins profiles as the caller.
--
-- block_member() also ends any UPCOMING sesh the two share as host and guest:
-- the blocker's guest becomes `kicked`, the blocker's own RSVP on the other's
-- sesh becomes `cancelled`. Past seshes do not change. No notification is
-- written — notifications come from server actions, and the block action
-- writes none. rsvps_clear_contributions runs as it does for any kick.
--
-- unblock_member() deletes the caller's own row and touches no RSVP: an
-- unblock never reopens a door by itself.
--
-- A new refusal code, M4W60: "cannot block that member". M4W5x is kept for
-- reports (Plan 06, step 2).

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'One row per blocker per blocked member. Written only through block_member and unblock_member. The wall is two-way: see private.is_blocked_between.';
comment on column public.blocks.is_demo is
  'The realm, copied from the blocker on insert by blocks_set_realm.';

-- The primary key serves blocker_id; this serves the reverse direction of
-- the wall and the foreign key.
create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- SELECT only, for Me -> Blocked. No member writes the table directly.
grant select on public.blocks to authenticated;
grant all on public.blocks to service_role;

-- A member reads the rows they wrote, never the rows that name them.
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (
    blocker_id = (select auth.uid())
    and private.same_realm(is_demo)
  );

-- The realm comes from the blocker and is never trusted from the writer. A
-- block across the realms is refused here too, so no service-side write can
-- mix them by mistake.
create or replace function public.blocks_set_realm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_demo := coalesce((select p.is_demo from public.profiles p where p.id = new.blocker_id), false);
  if not private.same_realm(new.is_demo, new.blocked_id) then
    raise exception 'realms do not mix' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.blocks_set_realm() from public, anon, authenticated;

create trigger blocks_set_realm
  before insert on public.blocks
  for each row execute function public.blocks_set_realm();

-- ---------------------------------------------------------------------------
-- Helpers. In `private`, which the Data API does not expose. A policy runs as
-- the caller, and the caller cannot read the rows that name them, so both are
-- SECURITY DEFINER.
-- ---------------------------------------------------------------------------

-- True when either member has blocked the other. Null on either side is
-- false: service_role has no auth.uid() and sits behind no wall.
create or replace function private.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke execute on function private.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated, service_role;

-- True when both members hold an approved seat at a sesh that neither of them
-- hosts. This is the one hole in the wall, and it is only a handle on a guest
-- list: the sesh itself is the third member's, readable on its own terms.
create or replace function private.in_same_room(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.rsvps ra
      join public.rsvps rb on rb.sesh_id = ra.sesh_id
      join public.seshes s on s.id = ra.sesh_id
     where ra.member_id = p_a
       and ra.status = 'approved'
       and rb.member_id = p_b
       and rb.status = 'approved'
       and s.host_id <> p_a
       and s.host_id <> p_b
  );
$$;

revoke execute on function private.in_same_room(uuid, uuid) from public, anon;
grant execute on function private.in_same_room(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies. Each is its last definition (…_demo_realm.sql) with the wall
-- added and nothing else changed.
-- ---------------------------------------------------------------------------

drop policy profiles_select_member on public.profiles;
create policy profiles_select_member
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      (private.can_browse((select auth.uid())) or (select private.is_admin()))
      and private.same_realm(is_demo)
      and private.owner_visible(id)
      and (
        not private.is_blocked_between(id, (select auth.uid()))
        or private.in_same_room(id, (select auth.uid()))
      )
    )
  );

comment on policy profiles_select_member on public.profiles is
  'Own row always; others only for a member who can browse, or an admin — same realm, never another visitor, and never across a block unless both are guests at a third member''s sesh. Issues #64, #39, #111.';

drop policy seshes_select on public.seshes;
create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and private.same_realm(is_demo)
    and private.owner_visible(host_id)
    and not private.is_blocked_between(host_id, (select auth.uid()))
    and (
      host_id = (select auth.uid())
      or private.has_rsvp(id, (select auth.uid()))
      or private.has_invite_claim(id, (select auth.uid()))
      or (visibility = 'listed' and status = 'open' and private.is_active_member(host_id))
    )
  );

-- ---------------------------------------------------------------------------
-- The exact location. A block kicks an upcoming guest, but a sesh that has
-- already started keeps its RSVPs, and the guest branch runs 12 hours past
-- the start. The wall closes that too.
-- ---------------------------------------------------------------------------

create or replace function private.can_see_address(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member(p_user)
     and exists (
       select 1
       from public.seshes s
       where s.id = p_sesh
         and private.same_realm(s.is_demo, p_user)
         and not private.is_blocked_between(s.host_id, p_user)
         and (
           s.host_id = p_user
           or (
             s.status = 'open'
             and now() < s.starts_at + interval '12 hours'
             and exists (
               select 1
               from public.rsvps r
               where r.sesh_id = s.id
                 and r.member_id = p_user
                 and r.status = 'approved'
             )
           )
         )
     );
$$;

-- ---------------------------------------------------------------------------
-- The RSVP door. Both functions are their last definition with the wall added
-- to an existing refusal, so a blocked member gets exactly the answer they
-- would get for a sesh that does not exist.
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

  if v_sesh.id is null
     or not private.same_realm(v_sesh.is_demo)
     or not private.owner_visible(v_sesh.host_id)
     or private.is_blocked_between(v_sesh.host_id, v_caller)
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

  if v_sesh.visibility = 'unlisted'
     and (v_existing.id is null or v_existing.status = 'denied')
     and not private.has_invite_claim(p_sesh, v_caller) then
    raise exception 'sesh is not taking requests' using errcode = 'M4W11';
  end if;

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

-- The wall is checked before the "already claimed" early return, so a claim
-- made before the block does not carry anybody back through the door.
create or replace function public.redeem_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_invite public.invites;
  v_sesh public.seshes;
  v_status public.member_status;
  v_claimed boolean;
begin
  if v_caller is null then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  if private.is_anonymous(v_caller) then
    raise exception 'not available in the demo' using errcode = 'M4W40';
  end if;

  select p.status into v_status from public.profiles p where p.id = v_caller;

  if v_status is null or v_status = 'suspended' then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  select * into v_invite from public.invites i where i.token_hash = p_token_hash for update;

  if v_invite.id is null then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  select * into v_sesh from public.seshes s where s.id = v_invite.sesh_id;

  if not private.sesh_takes_invites(v_sesh) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  if v_sesh.host_id = v_caller then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  if private.is_blocked_between(v_sesh.host_id, v_caller) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  if exists (
    select 1 from public.rsvps r
    where r.sesh_id = v_sesh.id
      and r.member_id = v_caller
      and r.status in ('denied', 'kicked')
  ) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  select true into v_claimed
    from public.invite_claims c
   where c.invite_id = v_invite.id
     and c.member_id = v_caller;

  if v_claimed then
    return v_invite.sesh_id;
  end if;

  if not private.invite_is_live(v_invite) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  insert into public.invite_claims (invite_id, member_id, sesh_id)
  values (v_invite.id, v_caller, v_invite.sesh_id);

  update public.invites i
     set use_count = i.use_count + 1,
         updated_at = now()
   where i.id = v_invite.id;

  return v_invite.sesh_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Block and unblock
-- ---------------------------------------------------------------------------

-- Any member who can browse may block, expired included: a lapsed card never
-- stops somebody keeping a person out. A demo visitor blocks for real, inside
-- the demo realm; their rows go with them when the visitor reaper runs.
--
-- The target must be somebody the caller could see without the wall: same
-- realm, not another visitor. Anything else is one answer, M4W60, so the
-- function cannot be used to test whether an id exists.
--
-- Blocking twice is not an error. The RSVP sweep runs again and finds nothing.
create or replace function public.block_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null or not private.can_browse(v_caller) then
    raise exception 'cannot block that member' using errcode = 'M4W60';
  end if;

  if p_member is null
     or p_member = v_caller
     or not exists (select 1 from public.profiles p where p.id = p_member)
     or not private.same_realm(
          (select p.is_demo from public.profiles p where p.id = p_member),
          v_caller
        )
     or not private.owner_visible(p_member) then
    raise exception 'cannot block that member' using errcode = 'M4W60';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_caller, p_member)
  on conflict (blocker_id, blocked_id) do nothing;

  -- The blocker's guest is out of the blocker's home.
  update public.rsvps r
     set status = 'kicked', decided_at = now()
    from public.seshes s
   where s.id = r.sesh_id
     and s.host_id = v_caller
     and s.starts_at > now()
     and r.member_id = p_member
     and r.status in ('requested', 'approved');

  -- The blocker is off the other's list.
  update public.rsvps r
     set status = 'cancelled', decided_at = now()
    from public.seshes s
   where s.id = r.sesh_id
     and s.host_id = p_member
     and s.starts_at > now()
     and r.member_id = v_caller
     and r.status in ('requested', 'approved');
end;
$$;

revoke execute on function public.block_member(uuid) from public, anon;
grant execute on function public.block_member(uuid) to authenticated;

comment on function public.block_member(uuid) is
  'Blocks a member: a two-way wall. Kicks the blocker''s upcoming guest and cancels the blocker''s upcoming RSVP on the other''s sesh. Sends nothing. Issue #111.';

-- Deletes the caller's own row, and nothing else. Old kicked and cancelled
-- RSVPs stay as they are. A block the other member placed is theirs to lift.
create or replace function public.unblock_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  delete from public.blocks b
   where b.blocker_id = v_caller
     and b.blocked_id = p_member;
end;
$$;

revoke execute on function public.unblock_member(uuid) from public, anon;
grant execute on function public.unblock_member(uuid) to authenticated;
