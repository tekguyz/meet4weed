-- Meet4Weed — card verification, the owner review queue, and expiry.
--
-- Spec §4. AI reads; a person approves. The ONLY path that sets
-- profiles.status = 'verified' is public.decide_verification, which requires
-- an admin. Images live in Storage, encrypted by the app; this file holds
-- their paths and nothing else.

-- ---------------------------------------------------------------------------
-- The private schema
--
-- Not in the Data API's exposed schemas, so nothing here is reachable through
-- /rest/v1/rpc. authenticated needs USAGE and EXECUTE anyway, because a policy
-- runs with the caller's privileges.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.florida_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

revoke execute on function private.florida_today() from public, anon;
grant execute on function private.florida_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.verification_status as enum (
  'pending_review',
  'approved',
  'rejected',
  'retake_requested',
  'lapsed'
);

create type public.document_kind as enum ('card', 'face_with_card');

-- ---------------------------------------------------------------------------
-- admins — who may review. Rows are added by scripts/grant-admin.mjs with the
-- service key. No grant to authenticated: a member can neither read nor write
-- this table, and am_i_admin() is the only question they can ask of it.
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
grant all on public.admins to service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke execute on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- verifications — one row per submission. No image columns (spec §6).
-- ---------------------------------------------------------------------------

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  patient_id text not null,
  typed_card_expires_on date not null,
  challenge text not null,
  previous_status public.member_status not null,
  status public.verification_status not null default 'pending_review',

  -- What Claude read. Null when the call was skipped or failed.
  reading jsonb,
  concerns text[] not null default '{}',
  vision_skipped_reason text,
  vision_error text,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 6),

  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  approved_card_expires_on date,
  created_at timestamptz not null default now(),

  constraint verifications_patient_id_length check (char_length(patient_id) between 1 and 40),
  constraint verifications_challenge_length check (char_length(challenge) between 1 and 120),
  constraint verifications_skip_reason check (
    vision_skipped_reason is null or vision_skipped_reason in ('daily_ceiling', 'limiter_unavailable')
  ),
  constraint verifications_decision_reason_length check (
    decision_reason is null or char_length(decision_reason) <= 500
  )
);

comment on table public.verifications is
  'Card submissions. Readable by admins only; a member sees their own status through my_verification_status().';

create index verifications_member_id_idx on public.verifications (member_id);
create index verifications_decided_by_idx on public.verifications (decided_by);
create index verifications_created_at_idx on public.verifications (created_at);
-- One pending submission per member, enforced rather than hoped for.
create unique index verifications_one_pending_idx
  on public.verifications (member_id)
  where status = 'pending_review';

alter table public.verifications enable row level security;

create policy verifications_select_admin
  on public.verifications
  for select
  to authenticated
  using ((select private.is_admin()));

grant select on public.verifications to authenticated;
grant all on public.verifications to service_role;

-- ---------------------------------------------------------------------------
-- verification_documents — one row per stored image.
-- ---------------------------------------------------------------------------

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.verifications (id) on delete cascade,
  kind public.document_kind not null,
  storage_path text not null,
  byte_size integer not null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  constraint verification_documents_one_per_kind unique (verification_id, kind)
);

create index verification_documents_expires_at_idx on public.verification_documents (expires_at);

alter table public.verification_documents enable row level security;

create policy verification_documents_select_admin
  on public.verification_documents
  for select
  to authenticated
  using ((select private.is_admin()));

grant select on public.verification_documents to authenticated;
grant all on public.verification_documents to service_role;

-- ---------------------------------------------------------------------------
-- admin_actions — the audit log (spec §11). Written only inside definer
-- functions; readable by admins.
-- ---------------------------------------------------------------------------

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  target_member_id uuid references public.profiles (id) on delete set null,
  verification_id uuid references public.verifications (id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index admin_actions_actor_id_idx on public.admin_actions (actor_id);
create index admin_actions_target_member_id_idx on public.admin_actions (target_member_id);
create index admin_actions_verification_id_idx on public.admin_actions (verification_id);

alter table public.admin_actions enable row level security;

create policy admin_actions_select_admin
  on public.admin_actions
  for select
  to authenticated
  using ((select private.is_admin()));

grant select on public.admin_actions to authenticated;
grant all on public.admin_actions to service_role;

-- ---------------------------------------------------------------------------
-- expiry_notices — proves the single expiry email went out once (spec §4.3).
-- ---------------------------------------------------------------------------

create table public.expiry_notices (
  member_id uuid not null references public.profiles (id) on delete cascade,
  card_expires_on date not null,
  sent_at timestamptz not null default now(),
  primary key (member_id, card_expires_on)
);

alter table public.expiry_notices enable row level security;
grant all on public.expiry_notices to service_role;

-- ---------------------------------------------------------------------------
-- Member-facing functions
-- ---------------------------------------------------------------------------

-- The latest submission's status and the reviewer's reason. Never Claude's
-- reading or concerns: telling a member what looked suspicious teaches them
-- what to fix in the next fake.
create or replace function public.my_verification_status()
returns table (
  status public.verification_status,
  decision_reason text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.status, v.decision_reason, v.created_at, v.decided_at
  from public.verifications v
  where v.member_id = (select auth.uid())
  order by v.created_at desc
  limit 1;
$$;

revoke execute on function public.my_verification_status() from public, anon;
grant execute on function public.my_verification_status() to authenticated;

-- The read-only gate (spec §4.3). Does not trust the sweep to have run: a card
-- past its date is inactive even if its status still says verified. Plan 03's
-- RSVP and hosting policies call this.
create or replace function private.is_active_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.status = 'verified'
      and p.card_expires_on >= private.florida_today()
  );
$$;

revoke execute on function private.is_active_member(uuid) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated, service_role;

create or replace function public.am_i_active_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_active_member((select auth.uid()));
$$;

revoke execute on function public.am_i_active_member() from public, anon;
grant execute on function public.am_i_active_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Service-only functions (the submission route, the reaper, the sweep)
-- ---------------------------------------------------------------------------

create or replace function public.begin_verification(
  p_member_id uuid,
  p_patient_id text,
  p_card_expires_on date,
  p_challenge text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = p_member_id for update;

  if v_profile.id is null or v_profile.attested_at is null then
    raise exception 'member has not attested' using errcode = 'M4W01';
  end if;
  if v_profile.status = 'suspended' then
    raise exception 'member is suspended' using errcode = 'M4W03';
  end if;
  if v_profile.status = 'pending_review'
     or exists (select 1 from public.verifications where member_id = p_member_id and status = 'pending_review') then
    raise exception 'a submission is already waiting' using errcode = 'M4W02';
  end if;
  if p_card_expires_on < private.florida_today() then
    raise exception 'card has already expired' using errcode = 'M4W04';
  end if;

  insert into public.verifications (member_id, patient_id, typed_card_expires_on, challenge, previous_status)
  values (p_member_id, trim(p_patient_id), p_card_expires_on, p_challenge, v_profile.status)
  returning id into v_id;

  -- A verified member renewing a still-valid card keeps full access while the
  -- new submission waits.
  if v_profile.status in ('unverified', 'expired') then
    update public.profiles set status = 'pending_review' where id = p_member_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.begin_verification(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.begin_verification(uuid, text, date, text) to service_role;

-- Ends a pending submission that will never be reviewed: its images were
-- reaped, or storing them failed. The member goes back to where they were.
create or replace function public.lapse_verification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verifications%rowtype;
begin
  select * into v from public.verifications where id = p_id for update;
  if v.id is null or v.status <> 'pending_review' then
    return;
  end if;

  update public.verifications set status = 'lapsed' where id = p_id;
  update public.profiles
    set status = v.previous_status
    where id = v.member_id and status = 'pending_review';
end;
$$;

revoke execute on function public.lapse_verification(uuid) from public, anon, authenticated;
grant execute on function public.lapse_verification(uuid) to service_role;

-- Flips verified members whose card date has passed to expired, then lists
-- members whose card expired in the last 7 days (today included) and who have
-- not had the expiry email for that date. The caller sends the email, then
-- inserts into expiry_notices, whose primary key makes a second send for the
-- same date impossible.
create or replace function public.expiry_sweep(p_today date)
returns table (member_id uuid, email text, card_expires_on date)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.profiles
    set status = 'expired'
    where status = 'verified' and card_expires_on < p_today;

  return query
    select p.id, u.email::text, p.card_expires_on
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.status in ('verified', 'expired')
      and p.card_expires_on between p_today - 7 and p_today
      and not exists (
        select 1 from public.expiry_notices n
        where n.member_id = p.id and n.card_expires_on = p.card_expires_on
      );
end;
$$;

revoke execute on function public.expiry_sweep(date) from public, anon, authenticated;
grant execute on function public.expiry_sweep(date) to service_role;

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

-- The only way a member becomes verified. Deleting the images is the caller's
-- next step (Storage objects cannot be removed from SQL). The reaper deletes
-- every document whose submission is no longer pending, so a failed delete
-- heals itself within a day.
create or replace function public.decide_verification(
  p_id uuid,
  p_decision text,
  p_reason text,
  p_card_expires_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verifications%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject', 'retake') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  if p_decision = 'approve' and (p_card_expires_on is null or p_card_expires_on < private.florida_today()) then
    raise exception 'approval needs a card expiry date that has not passed' using errcode = '22023';
  end if;
  if p_decision <> 'approve' and v_reason is null then
    raise exception 'a rejection or retake needs a reason the member will read' using errcode = '22023';
  end if;

  select * into v from public.verifications where id = p_id for update;
  if v.id is null or v.status <> 'pending_review' then
    raise exception 'submission is not waiting for review' using errcode = 'M4W05';
  end if;

  update public.verifications
    set status = case p_decision
                   when 'approve' then 'approved'::public.verification_status
                   when 'reject' then 'rejected'::public.verification_status
                   else 'retake_requested'::public.verification_status
                 end,
        decided_by = (select auth.uid()),
        decided_at = now(),
        decision_reason = v_reason,
        approved_card_expires_on = case when p_decision = 'approve' then p_card_expires_on end
    where id = p_id;

  if p_decision = 'approve' then
    update public.profiles
      set status = 'verified', card_expires_on = p_card_expires_on
      where id = v.member_id;
  else
    update public.profiles
      set status = v.previous_status
      where id = v.member_id and status = 'pending_review';
  end if;

  insert into public.admin_actions (actor_id, target_member_id, verification_id, action, reason)
  values (
    (select auth.uid()),
    v.member_id,
    p_id,
    case p_decision
      when 'approve' then 'verification_approved'
      when 'reject' then 'verification_rejected'
      else 'verification_retake_requested'
    end,
    v_reason
  );
end;
$$;

revoke execute on function public.decide_verification(uuid, text, text, date) from public, anon;
grant execute on function public.decide_verification(uuid, text, text, date) to authenticated;

create or replace function public.verification_spend()
returns table (today_usd numeric, month_usd numeric, today_calls integer, month_calls integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.florida_today();
begin
  if not private.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  return query
    select
      coalesce(sum(v.cost_usd) filter (where (v.created_at at time zone 'America/New_York')::date = v_today), 0),
      coalesce(sum(v.cost_usd), 0),
      (count(*) filter (where (v.created_at at time zone 'America/New_York')::date = v_today))::integer,
      count(*)::integer
    from public.verifications v
    where v.model is not null
      and v.created_at >= (date_trunc('month', v_today::timestamp) at time zone 'America/New_York');
end;
$$;

revoke execute on function public.verification_spend() from public, anon;
grant execute on function public.verification_spend() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: a private bucket with NO policies on storage.objects, so only
-- service_role can read or write it. The app encrypts every object before
-- upload (lib/verification/image-crypto.ts), so the stored bytes are
-- ciphertext even to someone holding the Supabase secret key.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-images', 'verification-images', false, 2097152)
on conflict (id) do nothing;
