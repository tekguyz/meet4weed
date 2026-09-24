-- Meet4Weed — changing a handle, safely (issue #70)
--
-- A member may change their handle once every 30 days. A handle somebody gives
-- up stays locked to everyone else for 30 days, so nobody can take it and pose
-- as its old owner.
--
-- Both are counting rules over time, and a counting rule cannot be a column
-- privilege. So UPDATE on `handle` is revoked from `authenticated`, and the one
-- way to change it is public.change_handle() below. What the column-grant rule
-- in CLAUDE.md protects against — a member talking their way past a check — is
-- answered here the way invites answer it: there is no other write path.

-- ---------------------------------------------------------------------------
-- The record
-- ---------------------------------------------------------------------------

-- One row per real change. It answers both questions the function asks:
-- "when did this member last change?" and "who gave this handle up, when?".
--
-- The placeholder the signup trigger writes (`member_…`) is never recorded as
-- given up. It is reserved, so nobody else could take it anyway.
create table public.handle_changes (
  id bigint generated always as identity primary key,
  -- Set null, not cascade, when the account goes: a deleted member's old
  -- handles stay locked for the rest of their 30 days, so nobody can pick one
  -- up the day after and pose as them.
  member_id uuid references public.profiles (id) on delete set null,
  -- Null on a member's first real handle, which replaced the placeholder.
  old_handle text,
  new_handle text not null,
  changed_at timestamptz not null default now()
);

comment on table public.handle_changes is
  'Every handle change. Written only by change_handle(). Drives the 30-day wait and the 30-day lock on a released handle.';

-- "When did I last change?" — also the index on the foreign key.
create index handle_changes_member_changed_idx
  on public.handle_changes (member_id, changed_at desc);

-- "Was this handle given up in the last 30 days?"
create index handle_changes_old_handle_changed_idx
  on public.handle_changes (old_handle, changed_at desc)
  where old_handle is not null;

alter table public.handle_changes enable row level security;

-- No policies for `authenticated`, and no grants: members never read or write
-- this table. change_handle() reads it as its owner.
grant all on public.handle_changes to service_role;

-- ---------------------------------------------------------------------------
-- The function
--
-- Refusals are raised with their own SQLSTATE, which the app turns into a
-- plain sentence (lib/profiles/handle-change.ts):
--   M4W30  taken       — another member holds it now
--   M4W31  locked      — another member gave it up in the last 30 days
--   M4W32  too soon    — DETAIL carries the instant the next change is allowed
--   M4W33  not allowed — bad format, or the reserved `member_` prefix
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

  -- Mirrors profiles_handle_format and lib/profiles/schema.ts. The prefix is
  -- refused here as well as in the form: a member who held `member_…` would
  -- look forever un-onboarded, and could squat on a future placeholder.
  if v_new is null or v_new !~ '^[a-z0-9_]{3,20}$' or v_new like 'member\_%' then
    raise exception 'that handle is not allowed' using errcode = 'M4W33';
  end if;

  -- Lock the member's own row, so two changes pressed at once cannot both
  -- pass the 30-day check.
  select handle into v_current
    from public.profiles
   where id = v_uid
     for update;

  if v_current is null then
    raise exception 'no profile' using errcode = '42501';
  end if;

  -- Saving the same handle again is not a change. Onboarding re-sends it
  -- when a member retries after a failed save.
  if v_new = v_current then
    return;
  end if;

  -- The first real handle, replacing the placeholder, waits for nothing.
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

  -- A member may take back their own old handle once their wait is over.
  -- Anyone else waits out the lock.
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
    -- Somebody took it between the check above and this line.
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

comment on function public.change_handle(text) is
  'The only way a member changes their handle. Enforces the 30-day wait and the 30-day lock on a released handle.';

-- Postgres grants EXECUTE to PUBLIC by default. A signed-out visitor has no
-- handle to change.
revoke execute on function public.change_handle(text) from public, anon;
grant execute on function public.change_handle(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Close the old door
--
-- Column privileges are checked before RLS, so a direct UPDATE naming
-- `handle` now fails with 42501 for a member. service_role holds `grant all`
-- on the table and keeps it.
-- ---------------------------------------------------------------------------

revoke update (handle) on public.profiles from authenticated;
