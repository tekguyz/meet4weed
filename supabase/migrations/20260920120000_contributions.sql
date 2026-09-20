-- ---------------------------------------------------------------------------
-- Plan 04, ticket #26 — the on-deck list.
--
-- What people are bringing to a sesh. A contribution is a STRAIN (a name and
-- a type) or an ITEM (snacks, papers, a lighter). The third answer is
-- "bringing none", and it is a ROW like any other — stored as a kind, never
-- as an absence.
--
-- That is the whole design. A member is in exactly one of three states:
--
--   no rows            -> has not said yet
--   exactly one 'none' -> bringing none
--   one or more real   -> bringing things
--
-- and the middle two are made mutually exclusive HERE, by a trigger that
-- fires both ways. A screen never has to work out whether a blank means
-- "none" or "not yet", because a blank can only ever mean one of them.
--
-- KNOWN COST, RECORDED DELIBERATELY. The exclusivity is a TRIGGER, not a
-- constraint. A constraint cannot be talked around; a trigger can be, by
-- future code that writes contributions some other way. The alternative — a
-- separate one-row-per-person state table with a composite foreign key —
-- makes it unbreakable at the price of a join on every read, a second policy
-- and a second set of grants. One table won. If a later plan adds an admin
-- path that writes contributions, THIS is the note that says to check the
-- trigger still fires.
--
-- Read opens at APPROVAL, not at asking. A requester reads an empty result —
-- not an error, not a partial list — and the locked card is rendered from
-- that emptiness. A strain name is not vague the way the fuzzy circle is.
--
-- There is NO admin branch. supabase/tests/__tests__/on-deck-rls.test.ts
-- asserts its absence.
-- ---------------------------------------------------------------------------

create type public.contribution_kind as enum ('strain', 'item', 'none');

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  sesh_id uuid not null references public.seshes (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  kind public.contribution_kind not null,
  -- Trimmed by contributions_guard() before this constraint is checked, so
  -- "60 characters" means 60 real ones and "   " is not a name.
  label text,
  -- Reuses the enum the profile already uses for preferred strain types. No
  -- second vocabulary for the same idea.
  strain_type public.strain_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Shape follows kind. A bad client cannot write junk: an item with a strain
  -- type, or a 'none' row carrying a label, is refused by the database.
  constraint contributions_shape check (
    (kind = 'strain' and label is not null and char_length(label) <= 60 and strain_type is not null)
    or (kind = 'item' and label is not null and char_length(label) <= 60 and strain_type is null)
    or (kind = 'none' and label is null and strain_type is null)
  )
);

comment on table public.contributions is
  'The on-deck list. Three states are three row-shapes; the trigger keeps the last two exclusive.';

-- "Automatically expose new tables" is OFF, so nothing is granted by default.
-- service_role bypasses row policies by attribute, never table privileges.
grant all on public.contributions to service_role;

grant select on public.contributions to authenticated;

-- COLUMN GRANTS, NOT TRIGGERS, protect what a member may write. Column
-- privileges are checked before RLS and cannot be talked around.
--
-- INSERT names the identity columns because an insert has to supply them; the
-- policy then pins member_id to the caller. UPDATE does NOT name them, so
-- `kind`, `sesh_id` and `member_id` are set once and never moved. Per
-- CLAUDE.md an UPDATE that names a non-granted column fails WHOLE with 42501
-- even when the value does not change — so the server actions send only
-- `label` and `strain_type`.
grant insert (sesh_id, member_id, kind, label, strain_type) on public.contributions to authenticated;
grant update (label, strain_type) on public.contributions to authenticated;
grant delete on public.contributions to authenticated;

-- Every foreign key, and every column a policy reads.
create index contributions_sesh_id_idx on public.contributions (sesh_id);
create index contributions_member_id_idx on public.contributions (member_id);
-- Serves the per-member cap count and the RSVP-leaves-approved sweep.
create index contributions_sesh_member_idx on public.contributions (sesh_id, member_id);

-- At most one "bringing none" per member per sesh. The trigger clears the
-- real rows; this makes the 'none' side a hard rule rather than a habit.
create unique index contributions_one_none_idx
  on public.contributions (sesh_id, member_id)
  where kind = 'none';

-- One person cannot list the same thing twice, ignoring case. 'none' rows
-- carry no label, so they are outside this index.
create unique index contributions_label_once_idx
  on public.contributions (sesh_id, member_id, lower(label))
  where label is not null;

-- ---------------------------------------------------------------------------
-- Policy helper
--
-- private.is_host and private.is_approved_guest already exist (#7) and are
-- reused. This one is new: it is the "the sesh is still taking writes" rule,
-- in one place, named once, so the four write policies cannot drift apart.
--
-- SECURITY DEFINER because a policy on `contributions` reading `seshes` would
-- otherwise run the seshes policy, which reads `rsvps`, which reads `seshes`.
-- ---------------------------------------------------------------------------

create or replace function private.sesh_takes_contributions(p_sesh uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.seshes s
    where s.id = p_sesh
      and s.status = 'open'
      and s.starts_at > now()
  );
$$;

revoke execute on function private.sesh_takes_contributions(uuid) from public, anon;
grant execute on function private.sesh_takes_contributions(uuid) to authenticated, service_role;

comment on function private.sesh_takes_contributions(uuid) is
  'The list is frozen once the host cancels, and once the sesh has started.';

-- ---------------------------------------------------------------------------
-- Row-level security. Enabled, never forced.
-- ---------------------------------------------------------------------------

alter table public.contributions enable row level security;

-- READ: the host and approved guests. Nobody else — not a requester, not a
-- denied or kicked or withdrawn member, not a stranger, and NOT the app's own
-- admin. can_browse rather than is_active_member, so a member whose card
-- lapses keeps reading (spec §4.3).
create policy contributions_select on public.contributions
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      private.is_host(sesh_id, (select auth.uid()))
      or private.is_approved_guest(sesh_id, (select auth.uid()))
    )
  );

-- WRITE: the same people, plus a current card. is_active_member is what makes
-- an expired member read-only here, exactly as it does everywhere else.
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
  );

-- EDIT: your own row and nobody else's. The host is absent from this policy
-- on purpose — putting words in a guest's mouth is not a moderation power.
create policy contributions_update on public.contributions
  for update to authenticated
  using (
    member_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
  )
  with check (member_id = (select auth.uid()));

-- REMOVE: your own row.
create policy contributions_delete_own on public.contributions
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
  );

-- REMOVE: the host takes down any row on their own sesh, because it is their
-- living room. A SEPARATE policy on DELETE, deliberately not a widening of
-- UPDATE: the host can remove a row, the host cannot rewrite one.
create policy contributions_delete_host on public.contributions
  for delete to authenticated
  using (
    private.is_host(sesh_id, (select auth.uid()))
    and private.is_active_member((select auth.uid()))
    and private.sesh_takes_contributions(sesh_id)
  );

-- ---------------------------------------------------------------------------
-- Trim, and the cap
--
-- SECURITY DEFINER so the count sees every row rather than the caller's view
-- of them. A cap that can be hidden from is not a cap.
--
-- Ten is a flood stop, not a security boundary, so it does not take a lock:
-- two simultaneous inserts could both see nine. The real boundary in this
-- app is capacity, and that one locks the sesh row (#7).
-- ---------------------------------------------------------------------------

create or replace function public.contributions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Before the CHECK, so the 60-character limit is 60 characters of name and
  -- a label of only spaces is no label at all.
  new.label := nullif(btrim(new.label), '');

  if tg_op = 'INSERT' and new.kind <> 'none' then
    select count(*) into v_count
      from public.contributions c
     where c.sesh_id = new.sesh_id
       and c.member_id = new.member_id
       and c.kind <> 'none';

    if v_count >= 10 then
      raise exception 'too many contributions' using errcode = 'M4W18';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.contributions_guard() from public, anon, authenticated;

create trigger contributions_guard
  before insert or update on public.contributions
  for each row execute function public.contributions_guard();

create trigger contributions_touch_updated_at
  before update on public.contributions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The exclusivity trigger — the one that fires BOTH ways
--
-- A real contribution deletes that member's 'none' row. A 'none' row deletes
-- that member's real ones. Neither direction can leave somebody in both
-- states, so the screen never has to pick one to hide.
--
-- AFTER, and the DELETE it issues does not fire this trigger, so there is no
-- recursion to guard against.
-- ---------------------------------------------------------------------------

create or replace function public.contributions_keep_exclusive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'none' then
    delete from public.contributions c
     where c.sesh_id = new.sesh_id
       and c.member_id = new.member_id
       and c.kind <> 'none';
  else
    delete from public.contributions c
     where c.sesh_id = new.sesh_id
       and c.member_id = new.member_id
       and c.kind = 'none';
  end if;

  return null;
end;
$$;

revoke execute on function public.contributions_keep_exclusive() from public, anon, authenticated;

create trigger contributions_keep_exclusive
  after insert or update on public.contributions
  for each row execute function public.contributions_keep_exclusive();

-- ---------------------------------------------------------------------------
-- Losing `approved` takes your rows with you
--
-- Denied, withdrawn or kicked — whichever it was, the host is not left
-- counting on something nobody is bringing. DELETE is covered too, so a
-- service-side tidy-up of an RSVP row cannot orphan a contribution.
-- ---------------------------------------------------------------------------

create or replace function public.rsvps_clear_contributions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and (tg_op = 'DELETE' or new.status <> 'approved') then
    delete from public.contributions c
     where c.sesh_id = old.sesh_id
       and c.member_id = old.member_id;
  end if;

  return null;
end;
$$;

revoke execute on function public.rsvps_clear_contributions() from public, anon, authenticated;

create trigger rsvps_clear_contributions
  after update or delete on public.rsvps
  for each row execute function public.rsvps_clear_contributions();
