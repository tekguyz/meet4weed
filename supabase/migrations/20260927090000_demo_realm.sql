-- Meet4Weed — the demo realm (issue #39, pass 1)
--
-- A second, sealed population in the same project: an invented CAST of members
-- and seshes, and VISITORS — one Supabase anonymous identity per press of the
-- demo button. See CONTEXT.md (Realm, Cast, Visitor) and
-- docs/adr/0003-demo-visitors-over-a-shared-cast.md.
--
-- Three walls, all in the database, none in a screen:
--
--   1. The realms cannot see each other, in either direction. Every policy on
--      a realm table carries one private.same_realm(is_demo) call, so every
--      realm check in the project is found by one grep.
--   2. Inside the demo realm a visitor sees the cast and their own rows, never
--      another visitor's. private.owner_visible(owner) is that rule.
--   3. Nothing a visitor does changes what the next visitor sees. A visitor's
--      RSVP never moves seshes.approved_count, and no notification is written
--      to a cast member.
--
-- WHO IS WHAT. A visitor is an anonymous identity (auth.users.is_anonymous)
-- whose profile has is_demo = true. The cast is a demo profile that is NOT
-- anonymous; it has no password and no email, so it can never sign in. So
-- every identity that can sign in to the demo realm is anonymous, and
-- "not anonymous" means "a real, signed-up member". The refusals below lean on
-- that: private.is_anonymous(caller) shuts out visitors AND any anonymous user
-- somebody makes straight from the publishable key (ADR 0003), which is a real-
-- realm unverified member that nobody pressed a button for.
--
-- WHICH TABLES CARRY THE FLAG.
--   profiles, seshes, rsvps, contributions — gain is_demo. On seshes it is
--     copied from the host, on rsvps and contributions from the sesh, by
--     BEFORE INSERT triggers; a row whose member and sesh sit in different
--     realms is refused outright. No member holds a write grant on it, so
--     nobody moves themselves or a row between realms.
--   notifications — no column. A member reads only rows addressed to them, and
--     no row is addressed to a cast member (the skip trigger below).
--   invites, invite_claims — no column; unreachable. mint_invite and
--     redeem_invite refuse every anonymous caller, and the cast has no invites.
--   push_subscriptions — no column; unreachable. The insert policy refuses
--     every anonymous caller.
--
-- A new refusal code, M4W40: "not available in the demo".

-- ---------------------------------------------------------------------------
-- The flag
-- ---------------------------------------------------------------------------

alter table public.profiles add column is_demo boolean not null default false;
alter table public.seshes add column is_demo boolean not null default false;
alter table public.rsvps add column is_demo boolean not null default false;
alter table public.contributions add column is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'The realm. true = the demo realm (cast and visitors). Written only by service_role; no member grant.';
comment on column public.seshes.is_demo is
  'The realm, copied from the host on insert by seshes_set_realm.';
comment on column public.rsvps.is_demo is
  'The realm, copied from the sesh on insert by set_realm_from_sesh.';
comment on column public.contributions.is_demo is
  'The realm, copied from the sesh on insert by set_realm_from_sesh.';

-- Partial: the demo realm is the small side, and a policy asks about it.
create index profiles_is_demo_idx on public.profiles (id) where is_demo;
create index seshes_is_demo_idx on public.seshes (id) where is_demo;
create index rsvps_is_demo_idx on public.rsvps (sesh_id) where is_demo;
create index contributions_is_demo_idx on public.contributions (sesh_id) where is_demo;

-- Readable, never writable. seshes uses column-level SELECT grants, so the
-- new column needs its own; the other three grant SELECT on the whole table.
-- Reading your realm tells you nothing: you only ever see rows of your own.
grant select (is_demo) on public.seshes to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers. All in `private`, which the Data API does not expose. A policy runs
-- as the caller, so `authenticated` needs EXECUTE.
-- ---------------------------------------------------------------------------

-- Whether an identity is anonymous. Reads auth.users, so SECURITY DEFINER.
-- A missing user is not anonymous.
create or replace function private.is_anonymous(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = p_user), false);
$$;

revoke execute on function private.is_anonymous(uuid) from public, anon;
grant execute on function private.is_anonymous(uuid) to authenticated, service_role;

-- Whether a row of realm p_is_demo is visible to p_user. A user with no
-- profile is in the real realm.
create or replace function private.same_realm(p_is_demo boolean, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_is_demo = coalesce((select p.is_demo from public.profiles p where p.id = p_user), false);
$$;

revoke execute on function private.same_realm(boolean, uuid) from public, anon;
grant execute on function private.same_realm(boolean, uuid) to authenticated, service_role;

-- The same question for the caller. This is the one every policy calls.
create or replace function private.same_realm(p_is_demo boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.same_realm(p_is_demo, (select auth.uid()));
$$;

revoke execute on function private.same_realm(boolean) from public, anon;
grant execute on function private.same_realm(boolean) to authenticated, service_role;

-- Visitor isolation: a row owned by a visitor is visible to that visitor
-- alone. Real members and the cast are never anonymous, so in the real realm
-- and for cast rows this is always true.
create or replace function private.owner_visible(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid()) or not private.is_anonymous(p_owner);
$$;

revoke execute on function private.owner_visible(uuid) from public, anon;
grant execute on function private.owner_visible(uuid) to authenticated, service_role;

-- A cast member: in the demo realm, and not a visitor.
create or replace function private.is_cast(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.is_demo)
     and not private.is_anonymous(p_user);
$$;

revoke execute on function private.is_cast(uuid) from public, anon;
grant execute on function private.is_cast(uuid) to authenticated, service_role;

-- A visitor may own three seshes, ever — cancelled ones count, or cancel-and-
-- create would hammer the free area-name service. Anyone not anonymous has
-- room; the open-sesh cap of five still applies to them. A `stable` function
-- counts what already exists, which is what an insert check wants.
create or replace function private.visitor_has_room(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_anonymous(p_user)
      or (select count(*) from public.seshes s where s.host_id = p_user) < 3;
$$;

revoke execute on function private.visitor_has_room(uuid) from public, anon;
grant execute on function private.visitor_has_room(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realm triggers. The flag is never trusted from the writer.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_set_realm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_demo := coalesce((select p.is_demo from public.profiles p where p.id = new.host_id), false);
  return new;
end;
$$;

revoke execute on function public.seshes_set_realm() from public, anon, authenticated;

create trigger seshes_set_realm
  before insert on public.seshes
  for each row execute function public.seshes_set_realm();

-- rsvps and contributions: the row takes the sesh's realm, and a member of the
-- other realm is refused. This holds for service_role too, so no server-side
-- write can mix the realms by mistake.
create or replace function public.set_realm_from_sesh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_demo := coalesce((select s.is_demo from public.seshes s where s.id = new.sesh_id), false);
  if not private.same_realm(new.is_demo, new.member_id) then
    raise exception 'realms do not mix' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.set_realm_from_sesh() from public, anon, authenticated;

create trigger rsvps_set_realm
  before insert on public.rsvps
  for each row execute function public.set_realm_from_sesh();

create trigger contributions_set_realm
  before insert on public.contributions
  for each row execute function public.set_realm_from_sesh();

-- ---------------------------------------------------------------------------
-- Policies. Each gains one private.same_realm(is_demo); the reads of rows a
-- member owns also gain private.owner_visible(owner).
-- ---------------------------------------------------------------------------

-- profiles --------------------------------------------------------------------

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
    )
  );

comment on policy profiles_select_member on public.profiles is
  'Own row always; others only for a member who can browse, or an admin — same realm, and never another visitor. Issues #64, #39.';

-- An anonymous identity outside the demo realm is somebody who called the
-- sign-up API with the publishable key and no button. It may write nothing,
-- not even its own bio: a real member could otherwise read it in the
-- directory.
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    and private.same_realm(is_demo)
    and (is_demo or not private.is_anonymous(id))
  )
  with check (
    id = (select auth.uid())
    and private.same_realm(is_demo)
  );

-- seshes ----------------------------------------------------------------------

drop policy seshes_select on public.seshes;
create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and private.same_realm(is_demo)
    and private.owner_visible(host_id)
    and (
      host_id = (select auth.uid())
      or private.has_rsvp(id, (select auth.uid()))
      or private.has_invite_claim(id, (select auth.uid()))
      or (visibility = 'listed' and status = 'open' and private.is_active_member(host_id))
    )
  );

-- WITH CHECK runs after the BEFORE INSERT trigger, so is_demo is already the
-- host's realm here.
drop policy seshes_insert on public.seshes;
create policy seshes_insert on public.seshes
  for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.open_sesh_count((select auth.uid())) < 5
    and private.visitor_has_room((select auth.uid()))
    and private.same_realm(is_demo)
  );

drop policy seshes_update on public.seshes;
create policy seshes_update on public.seshes
  for update to authenticated
  using (
    host_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.same_realm(is_demo)
  )
  with check (
    host_id = (select auth.uid())
    and private.same_realm(is_demo)
  );

-- rsvps -----------------------------------------------------------------------

-- A cast host's guest list, seen by a visitor, is the cast and that visitor.
drop policy rsvps_select on public.rsvps;
create policy rsvps_select on public.rsvps
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and private.same_realm(is_demo)
    and private.owner_visible(member_id)
    and (
      member_id = (select auth.uid())
      or private.is_host(sesh_id, (select auth.uid()))
      or (status = 'approved' and private.is_approved_guest(sesh_id, (select auth.uid())))
    )
  );

-- contributions ---------------------------------------------------------------

drop policy contributions_select on public.contributions;
create policy contributions_select on public.contributions
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and private.same_realm(is_demo)
    and private.owner_visible(member_id)
    and (
      private.is_host(sesh_id, (select auth.uid()))
      or private.is_approved_guest(sesh_id, (select auth.uid()))
    )
  );

drop policy contributions_insert on public.contributions;
create policy contributions_insert on public.contributions
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
    and (
      private.is_host(sesh_id, (select auth.uid()))
      or private.is_approved_guest(sesh_id, (select auth.uid()))
    )
    and private.same_realm(is_demo)
  );

drop policy contributions_update on public.contributions;
create policy contributions_update on public.contributions
  for update to authenticated
  using (
    member_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
    and private.same_realm(is_demo)
  )
  with check (
    member_id = (select auth.uid())
    and private.same_realm(is_demo)
  );

drop policy contributions_delete_own on public.contributions;
create policy contributions_delete_own on public.contributions
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
    and private.same_realm(is_demo)
  );

drop policy contributions_delete_host on public.contributions;
create policy contributions_delete_host on public.contributions
  for delete to authenticated
  using (
    private.is_host(sesh_id, (select auth.uid()))
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
    and private.same_realm(is_demo)
  );

-- push_subscriptions ----------------------------------------------------------

-- No push service ever holds an endpoint for an anonymous identity.
drop policy push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and not private.is_anonymous((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- The exact location. Neither realm reads the other's by any route.
--
-- Structurally it already could not: the host branch is your own sesh, and the
-- guest branch needs an approved RSVP, which set_realm_from_sesh refuses
-- across realms. The realm check is written anyway, because this function
-- guards real members' home addresses and a second lock costs nothing.
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
-- The seat count is the cast's count, for every visitor, forever.
--
-- A visitor's RSVP changes nothing it counts, so the trigger does not even
-- touch the sesh row: its updated_at stays what the cast file wrote.
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
  if private.is_anonymous(coalesce(new.member_id, old.member_id)) then
    return null;
  end if;

  update public.seshes s
     set approved_count = (
       select count(*)
         from public.rsvps r
        where r.sesh_id = v_sesh
          and r.status = 'approved'
          and not private.is_anonymous(r.member_id)
     )
   where s.id = v_sesh;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- The nightly shift of a cast sesh is not "the host moved it". Without this,
-- every cast sesh would wear a "the host changed this" stamp every morning.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_stamp_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_metres double precision;
begin
  if new.is_demo and private.is_cast(new.host_id) then
    new.materially_changed_at := old.materially_changed_at;
    return new;
  end if;

  if old.exact_lat is not null and new.exact_lat is not null
     and (new.exact_lat is distinct from old.exact_lat or new.exact_lng is distinct from old.exact_lng) then
    v_metres := sqrt(
      power((new.exact_lat - old.exact_lat) * 111320.0, 2) +
      power((new.exact_lng - old.exact_lng) * 111320.0 * cos(radians(old.exact_lat)), 2)
    );
    if v_metres > 1000.0 then
      new.materially_changed_at := now();
      return new;
    end if;
  end if;

  if abs(extract(epoch from (new.starts_at - old.starts_at))) > 3600 then
    new.materially_changed_at := now();
    return new;
  end if;

  new.materially_changed_at := old.materially_changed_at;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- No notification to a cast member. Nobody would ever read it, and hundreds
-- of visits would leave hundreds of rows. Server actions write notifications
-- through service_role; skipping here covers every one of them at once.
-- Returning null from a BEFORE trigger drops the row without an error.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_skip_cast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_cast(new.recipient_id) then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.notifications_skip_cast() from public, anon, authenticated;

create trigger notifications_skip_cast
  before insert on public.notifications
  for each row execute function public.notifications_skip_cast();

-- ---------------------------------------------------------------------------
-- RSVPs. Each function below is its last definition with the new lines added
-- and nothing else changed.
-- ---------------------------------------------------------------------------

-- A sesh in the other realm, or another visitor's, is "not taking requests":
-- the same answer as every other reason, so the function cannot be used to
-- test whether an id exists.
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

-- Nobody approves in the demo. A visitor's own sesh has no guests to decide
-- on, and a visitor's request on a cast sesh stays requested.
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
  if private.is_anonymous(v_caller) then
    raise exception 'not available in the demo' using errcode = 'M4W40';
  end if;

  if p_decision not in ('approved', 'denied', 'kicked') then
    raise exception 'unknown decision' using errcode = 'M4W15';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp;
  if v_rsvp.id is null then
    raise exception 'no such request' using errcode = 'M4W15';
  end if;

  select * into v_sesh from public.seshes where id = v_rsvp.sesh_id for update;

  if v_sesh.host_id is distinct from v_caller or not private.is_active_member(v_caller) then
    raise exception 'not the host' using errcode = 'M4W15';
  end if;

  if v_sesh.status <> 'open' then
    raise exception 'sesh is closed' using errcode = 'M4W11';
  end if;

  if p_decision = 'approved' then
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

-- ---------------------------------------------------------------------------
-- Invites. No demo link escapes into the world, and an anonymous identity
-- cannot burn a use of a real member's link.
-- ---------------------------------------------------------------------------

create or replace function public.mint_invite(
  p_sesh uuid,
  p_token_hash text,
  p_max_uses integer,
  p_expires_at timestamptz
)
returns table (invite_id uuid, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_sesh public.seshes;
  v_live integer;
  v_expires timestamptz;
  v_id uuid;
begin
  if private.is_anonymous(v_caller) then
    raise exception 'not available in the demo' using errcode = 'M4W40';
  end if;

  if not private.is_active_member(v_caller) then
    raise exception 'card is not current' using errcode = 'M4W10';
  end if;

  select * into v_sesh from public.seshes s where s.id = p_sesh;

  if v_sesh.host_id is distinct from v_caller
     or not private.sesh_takes_invites(v_sesh) then
    raise exception 'cannot make a link for that sesh' using errcode = 'M4W20';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 10 then
    raise exception 'uses must be between 1 and 10' using errcode = 'M4W22';
  end if;

  v_expires := least(coalesce(p_expires_at, v_sesh.starts_at), v_sesh.starts_at);

  if v_expires <= now() then
    raise exception 'that expiry has already passed' using errcode = 'M4W22';
  end if;

  select count(*) into v_live
    from public.invites i
   where i.sesh_id = p_sesh
     and private.invite_is_live(i);

  if v_live >= 5 then
    raise exception 'five live links is the most for one sesh' using errcode = 'M4W21';
  end if;

  insert into public.invites (sesh_id, created_by, token_hash, expires_at, max_uses)
  values (p_sesh, v_caller, p_token_hash, v_expires, p_max_uses)
  returning id into v_id;

  return query
    select i.id, i.expires_at, i.max_uses from public.invites i where i.id = v_id;
end;
$$;

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

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_sesh uuid;
begin
  if private.is_anonymous(v_caller) then
    raise exception 'not available in the demo' using errcode = 'M4W40';
  end if;

  select i.sesh_id into v_sesh from public.invites i where i.id = p_invite;

  if v_sesh is null or not private.is_host(v_sesh, v_caller) then
    raise exception 'cannot revoke that link' using errcode = 'M4W20';
  end if;

  update public.invites i
     set revoked_at = now()
   where i.id = p_invite
     and i.revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Handles. Unique across both realms, so a throwaway identity must not hold
-- one: an anonymous caller is refused, and the `visitor_` prefix the demo
-- door writes is reserved like `member_`.
--
-- Found 2026-09-27: before this, change_handle() checked only that the caller
-- was signed in. With anonymous sign-ins on, a bot holding the publishable key
-- could have minted identities and squatted handles.
-- ---------------------------------------------------------------------------

create or replace function public.change_handle(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new text := lower(trim(p_handle));
  v_current text;
  v_last timestamptz;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  if private.is_anonymous(v_uid) then
    raise exception 'not available in the demo' using errcode = 'M4W40';
  end if;

  if v_new is null or v_new !~ '^[a-z0-9_]{3,20}$'
     or v_new like 'member\_%' or v_new like 'visitor\_%' then
    raise exception 'that handle is not allowed' using errcode = 'M4W33';
  end if;

  select handle into v_current
    from public.profiles
   where id = v_uid
     for update;

  if v_current is null then
    raise exception 'no profile' using errcode = '42501';
  end if;

  if v_new = v_current then
    return;
  end if;

  if v_current not like 'member\_%' then
    select max(changed_at) into v_last
      from public.handle_changes
     where member_id = v_uid;

    if v_last is not null and v_last > now() - interval '30 days' then
      raise exception 'handle changed less than 30 days ago'
        using errcode = 'M4W32',
              detail = to_char((v_last + interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    end if;
  end if;

  if exists (select 1 from public.profiles where handle = v_new) then
    raise exception 'that handle is taken' using errcode = 'M4W30';
  end if;

  if exists (
    select 1
      from public.handle_changes
     where old_handle = v_new
       and changed_at > now() - interval '30 days'
       and member_id is distinct from v_uid
  ) then
    raise exception 'that handle was given up recently' using errcode = 'M4W31';
  end if;

  begin
    update public.profiles set handle = v_new where id = v_uid;
  exception when unique_violation then
    raise exception 'that handle is taken' using errcode = 'M4W30';
  end;

  insert into public.handle_changes (member_id, old_handle, new_handle)
  values (
    v_uid,
    case when v_current like 'member\_%' then null else v_current end,
    v_new
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The cast's schedule
--
-- A cast sesh's time is stored as a day offset from Florida's today and a
-- local wall-clock time, so "Thursday 7:30 pm" stays 7:30 pm. The cast file
-- (supabase/demo-cast.sql) writes these rows and then calls
-- shift_demo_cast(), and so does the nightly sweep: both compute real dates
-- from the same numbers.
--
-- One row is the unlock sesh: the demo door gives each new visitor an
-- approved RSVP on it, so the fuzzy circle resolves within a minute. Any
-- future start works — the guest branch of can_see_address has no lower
-- bound — so it sits a day or more ahead and survives a missed night.
--
-- service_role only. No member reads it.
-- ---------------------------------------------------------------------------

create table public.cast_schedule (
  sesh_id uuid primary key references public.seshes (id) on delete cascade,
  day_offset integer not null,
  local_time time not null,
  is_unlock boolean not null default false,
  -- Within the last six days (the 7-day reapers never reach it) and at most
  -- two weeks ahead.
  constraint cast_schedule_day_offset_range check (day_offset between -6 and 14),
  constraint cast_schedule_unlock_ahead check (not is_unlock or day_offset >= 2)
);

comment on table public.cast_schedule is
  'When each cast sesh happens, relative to today. Written by supabase/demo-cast.sql; applied by shift_demo_cast().';

create unique index cast_schedule_one_unlock_idx on public.cast_schedule (is_unlock) where is_unlock;

alter table public.cast_schedule enable row level security;
grant all on public.cast_schedule to service_role;

-- ---------------------------------------------------------------------------
-- The nightly work (lib/demo/nightly.ts calls both from the expiry sweep)
-- ---------------------------------------------------------------------------

-- Moves every cast sesh to its offset from today, in place. Never deletes, so
-- a visitor's RSVP on a cast sesh survives. Also keeps every cast card a year
-- ahead, so the cast never expires and never drops out of the feed.
create or replace function public.shift_demo_cast()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moved integer;
  v_today date := private.florida_today();
begin
  update public.profiles p
     set status = 'verified',
         card_expires_on = v_today + 365
   where p.is_demo
     and not private.is_anonymous(p.id)
     and (p.status <> 'verified' or p.card_expires_on is distinct from v_today + 365);

  with moved as (
    update public.seshes s
       set starts_at = ((v_today + c.day_offset) + c.local_time) at time zone 'America/New_York'
      from public.cast_schedule c
     where c.sesh_id = s.id
       and s.is_demo
       and s.starts_at is distinct from ((v_today + c.day_offset) + c.local_time) at time zone 'America/New_York'
    returning 1
  )
  select count(*)::integer into v_moved from moved;

  return v_moved;
end;
$$;

revoke execute on function public.shift_demo_cast() from public, anon, authenticated;
grant execute on function public.shift_demo_cast() to service_role;

-- Deletes every visitor who arrived more than seven days ago. The delete from
-- auth.users cascades to the profile, and from it to their seshes, RSVPs,
-- on-deck rows and notifications.
--
-- SELECTING ON is_anonymous IS WHAT MAKES THIS SAFE. A real member signed up
-- with an email and a password, and the cast is written with neither but is
-- not anonymous, so no age and no realm can bring either into this delete.
--
-- "Arrived" is the profile's created_at, which the signup trigger writes in
-- the same transaction as the auth row. It is read from the profile because a
-- test can backdate a profile and cannot backdate auth.users.
create or replace function public.reap_demo_visitors()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with gone as (
    delete from auth.users u
     where u.is_anonymous
       and coalesce(
             (select p.created_at from public.profiles p where p.id = u.id),
             u.created_at
           ) < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer into v_deleted from gone;

  return v_deleted;
end;
$$;

revoke execute on function public.reap_demo_visitors() from public, anon, authenticated;
grant execute on function public.reap_demo_visitors() to service_role;
