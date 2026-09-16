-- Meet4Weed — profiles
--
-- One row per auth user. Created by a trigger on signup so that a session
-- always has a profile to read; a null-profile branch in every query is how
-- this goes wrong.
--
-- `status` is the single gate the whole app reads. Nothing outside the
-- verification flow may write it. That is enforced by COLUMN-LEVEL PRIVILEGES
-- rather than a trigger — see the grants at the bottom of this file.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.member_status as enum (
  'unverified',
  'pending_review',
  'verified',
  'expired',
  'suspended'
);

create type public.strain_type as enum ('indica', 'sativa', 'hybrid', 'any');

create type public.consumption_method as enum ('flower', 'vape', 'edibles', 'dabs', 'any');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text,
  bio text,
  city text,
  avatar_url text,
  strain_prefs public.strain_type[] not null default '{}',
  method_prefs public.consumption_method[] not null default '{}',
  vibe_tags text[] not null default '{}',
  status public.member_status not null default 'unverified',
  card_expires_on date,
  attested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Handles are the public identifier and appear in URLs. Lowercase-only so
  -- "Ryder" and "ryder" cannot both exist and impersonate each other.
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 40),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 280),
  constraint profiles_city_length check (city is null or char_length(city) <= 60),
  constraint profiles_vibe_tags_count check (cardinality(vibe_tags) <= 8)
);

comment on table public.profiles is
  'Member directory. Card images and verification evidence live elsewhere; nothing on this table is private between members.';
comment on column public.profiles.status is
  'The single gate the app reads. Writable only by service_role — see the column grants in this migration.';

create unique index profiles_handle_key on public.profiles (handle);
create index profiles_status_idx on public.profiles (status);
create index profiles_card_expires_on_idx on public.profiles (card_expires_on)
  where card_expires_on is not null;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Deliberately NOT `force row level security`. FORCE applies policies to the
-- table owner as well, and public.handle_new_user() below is SECURITY DEFINER
-- owned by postgres. With FORCE on and no INSERT policy, that function cannot
-- insert and signup breaks outright. service_role has the BYPASSRLS attribute,
-- which is unaffected either way, so FORCE would buy nothing here.

-- Read: any signed-in member may read any profile. Card data is NOT on this
-- table, so there is nothing sensitive here; the directory is the product.
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

-- Write: your own row only. auth.uid() is wrapped in a subselect so Postgres
-- evaluates it once per statement instead of once per row.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policy for `authenticated`, deliberately. Rows are
-- created by the signup trigger below and removed by the cascade from
-- auth.users. A member cannot mint a second profile or delete their own row to
-- escape a suspension.

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile the moment the auth user exists. The placeholder handle is
-- derived from the uuid, so it is unique by construction, and it is 19
-- characters — inside the 20-character limit the format check imposes.
-- Onboarding replaces it; app/page.tsx treats the `member_` prefix as the
-- signal that onboarding is unfinished.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle)
  values (new.id, 'member_' || substr(replace(new.id::text, '-', ''), 1, 12));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges
--
-- This project was created with "Automatically expose new tables" OFF, so a
-- new table reaches the Data API only through the grants written here. That is
-- the point: a table is invisible until someone decides otherwise.
--
-- The column list on the UPDATE grant is the real guard on `status` and
-- `card_expires_on`. Column privileges are checked before RLS and cannot be
-- talked around by a cleverly shaped UPDATE, which is why this is a grant and
-- not a trigger. A member who tries to set their own status gets 42501.
--
-- `attested_at` IS granted: attestation is a self-declaration, and the server
-- action that records it runs with the member's own session.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;

grant update (
  handle,
  display_name,
  bio,
  city,
  avatar_url,
  strain_prefs,
  method_prefs,
  vibe_tags,
  attested_at
) on public.profiles to authenticated;

-- No grants to `anon`: the directory is for members. No INSERT or DELETE to
-- anyone but service_role, which bypasses all of this by attribute.
