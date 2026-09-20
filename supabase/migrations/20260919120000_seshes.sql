-- ---------------------------------------------------------------------------
-- Plan 03, ticket #4 — seshes and the fuzzy circle.
--
-- A sesh happens at somebody's home. The exact address is therefore not a
-- column a member is allowed to read, in any query, ever. Three things stack,
-- and Postgres checks them in this order:
--
--   1. Column-level SELECT privileges. `authenticated` holds no SELECT grant
--      on exact_lat, exact_lng, address_line, unit_note or gate_code, so a
--      query naming one fails whole with 42501. A privilege is checked before
--      RLS and cannot be talked around by a policy, a view or a client bug.
--   2. Column-level INSERT/UPDATE privileges, which Postgres tracks
--      separately. A host therefore writes their address and cannot read it
--      back through the table.
--   3. public.sesh_address(), a security-definer function that returns the
--      private fields or no rows at all.
--
-- This migration ships the HOST branch of the unlock only. The guest branch
-- needs the rsvps table and arrives with it (#8).
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create type public.sesh_type as enum (
  'chill',
  'smoke_circle',
  'movie_night',
  'game_night',
  'outdoors',
  'creative'
);

create type public.sesh_status as enum ('open', 'cancelled');

-- ---------------------------------------------------------------------------
-- The pepper
--
-- The fuzzy circle is a fixed function of the address, so that one home always
-- produces one circle. A host running ten seshes then gives nobody ten samples
-- to average, which a per-sesh random offset would.
--
-- That only holds if the function is unguessable. The sesh id is public, so a
-- seed derived from it would be public too, and the offset could be subtracted
-- back off. The seed is an HMAC against this pepper instead.
--
-- The value is generated HERE rather than written into this file, so it never
-- enters git and differs per environment. It is never rotated: rotating it
-- would move every circle in the app at once. `on conflict do nothing` keeps a
-- re-run from replacing it.
--
-- No grants. Only the security-definer functions below, owned by postgres,
-- read it. It is in `private`, which the Data API does not expose.
-- ---------------------------------------------------------------------------

create table if not exists private.fuzz_pepper (
  only_row boolean primary key default true,
  pepper bytea not null default extensions.gen_random_bytes(32),
  created_at timestamptz not null default now(),
  constraint fuzz_pepper_singleton check (only_row)
);

insert into private.fuzz_pepper (only_row) values (true) on conflict (only_row) do nothing;

revoke all on private.fuzz_pepper from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The offset
--
-- Bearing is uniform around the circle. Distance is uniform over the RING
-- between 150 m and 400 m — `sqrt(min² + u·(max² − min²))` spreads points
-- evenly by area rather than bunching them at the centre.
--
-- The 150 m floor exists because the host cannot reshuffle their circle: it is
-- a function of their address. Without a floor, roughly one sesh in 1,600
-- would draw a circle centred on the front door and the host could do nothing
-- about it. The price is that someone who knows the scheme can rule out the
-- inner 14% of the disc. That is the cheaper side of the trade.
--
-- Metres to degrees uses a flat approximation. At Florida's latitude it is
-- about 0.4% short, which is immaterial at this scale and keeps the function
-- readable. Output is rounded to 5 decimal places (~1 m) to strip float noise
-- without pushing the offset outside the band.
-- ---------------------------------------------------------------------------

create or replace function private.fuzz_point(
  p_lat double precision,
  p_lng double precision
)
returns table (lat double precision, lng double precision)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pepper bytea;
  v_seed bytea;
  v_bearing double precision;
  v_u double precision;
  v_r double precision;
  v_min constant double precision := 150.0;
  v_max constant double precision := 400.0;
begin
  if p_lat is null or p_lng is null then
    return query select null::double precision, null::double precision;
    return;
  end if;

  select fp.pepper into v_pepper from private.fuzz_pepper fp where fp.only_row;

  -- numeric keeps its scale through round(), so 27.95 renders as "27.9500".
  -- The key is therefore stable for the same address across every call.
  v_seed := extensions.hmac(
    round(p_lat::numeric, 4)::text || ',' || round(p_lng::numeric, 4)::text,
    v_pepper,
    'sha256'
  );

  -- 24 bits each, from disjoint parts of the digest.
  v_bearing := 2 * pi() * (
    (get_byte(v_seed, 0) * 65536 + get_byte(v_seed, 1) * 256 + get_byte(v_seed, 2))::double precision / 16777216.0
  );
  v_u := (get_byte(v_seed, 3) * 65536 + get_byte(v_seed, 4) * 256 + get_byte(v_seed, 5))::double precision / 16777216.0;

  v_r := sqrt(v_min * v_min + v_u * (v_max * v_max - v_min * v_min));

  lat := round((p_lat + (v_r * cos(v_bearing)) / 111320.0)::numeric, 5)::double precision;
  lng := round((p_lng + (v_r * sin(v_bearing)) / (111320.0 * cos(radians(p_lat))))::numeric, 5)::double precision;
  return next;
end;
$$;

revoke execute on function private.fuzz_point(double precision, double precision) from public, anon, authenticated;
grant execute on function private.fuzz_point(double precision, double precision) to service_role;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.seshes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  description text,
  sesh_type public.sesh_type not null,
  starts_at timestamptz not null,
  capacity integer not null,
  status public.sesh_status not null default 'open',

  -- Private. No SELECT grant to `authenticated`, here or ever.
  -- Nullable so the 7-day wipe (#10) can clear them; naming a column
  -- `exact_lat` and storing a fuzzy value there instead would be a column
  -- that lies about itself.
  exact_lat double precision,
  exact_lng double precision,
  address_line text,
  unit_note text,
  gate_code text,

  -- Derived by the trigger below. No grant lets a host write them.
  fuzzy_lat double precision,
  fuzzy_lng double precision,
  fuzzy_radius_m integer not null default 400,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint seshes_title_length check (char_length(title) between 3 and 80),
  constraint seshes_description_length check (description is null or char_length(description) <= 1000),
  -- Capacity counts GUESTS. The host is not a seat.
  constraint seshes_capacity_range check (capacity between 1 and 50),
  constraint seshes_address_length check (address_line is null or char_length(address_line) <= 200),
  constraint seshes_unit_note_length check (unit_note is null or char_length(unit_note) <= 60),
  constraint seshes_gate_code_length check (gate_code is null or char_length(gate_code) <= 40),
  constraint seshes_exact_point_pair check ((exact_lat is null) = (exact_lng is null)),
  constraint seshes_exact_lat_range check (exact_lat is null or exact_lat between -90 and 90),
  constraint seshes_exact_lng_range check (exact_lng is null or exact_lng between -180 and 180)
);

comment on table public.seshes is
  'A gathering at a member''s home. The exact location columns carry no SELECT grant for authenticated — read them through public.sesh_address().';
comment on column public.seshes.fuzzy_lat is
  'Written by the trigger from the address and a secret pepper. Same address, same circle, every time.';

-- ---------------------------------------------------------------------------
-- Triggers
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
  if tg_op = 'INSERT'
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

create trigger seshes_set_fuzzy
  before insert or update on public.seshes
  for each row execute function public.seshes_set_fuzzy();

create trigger seshes_touch_updated_at
  before update on public.seshes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
--
-- The column lists ARE the security rule. Note that SELECT omits every
-- private location column while INSERT and UPDATE include them: Postgres
-- tracks those privileges separately, so a host writes an address they can
-- never read back through the table.
--
-- There is no DELETE grant. A host cancels a sesh; cancelling is final.
-- ---------------------------------------------------------------------------

grant select (
  id, host_id, title, description, sesh_type, starts_at, capacity, status,
  fuzzy_lat, fuzzy_lng, fuzzy_radius_m, created_at, updated_at
) on public.seshes to authenticated;

grant insert (
  host_id, title, description, sesh_type, starts_at, capacity,
  exact_lat, exact_lng, address_line, unit_note, gate_code
) on public.seshes to authenticated;

grant update (
  title, description, sesh_type, starts_at, capacity, status,
  exact_lat, exact_lng, address_line, unit_note, gate_code
) on public.seshes to authenticated;

-- "Automatically expose new tables" is OFF, so nothing is granted by default.
-- service_role bypasses row policies by attribute, never table privileges.
grant all on public.seshes to service_role;

-- ---------------------------------------------------------------------------
-- Policy helpers
-- ---------------------------------------------------------------------------

-- Deliberately wider than private.is_active_member: an expired member is
-- read-only, not shut out (spec §4.3), and lib/member/gate.ts already returns
-- `read_only` for them. Reads use this; every write uses is_active_member.
create or replace function private.can_browse(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.status in ('verified', 'expired')
  );
$$;

revoke execute on function private.can_browse(uuid) from public, anon;
grant execute on function private.can_browse(uuid) to authenticated, service_role;

-- The spam cap. A `stable` function cannot see the row being inserted, which
-- is what we want: it counts what already exists. Two simultaneous inserts
-- could both see four — this is a flood stop, not a security boundary, and
-- the real one (capacity) takes a row lock in #7.
create or replace function private.open_sesh_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.seshes s
  where s.host_id = p_user
    and s.status = 'open'
    and s.starts_at > now();
$$;

revoke execute on function private.open_sesh_count(uuid) from public, anon;
grant execute on function private.open_sesh_count(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Enabled, never forced. Forcing applies policies to the table owner, which
-- breaks SECURITY DEFINER functions owned by postgres — it stopped signup
-- outright in Plan 01. It buys nothing, because service_role bypasses by
-- attribute.
-- ---------------------------------------------------------------------------

alter table public.seshes enable row level security;

-- A host always sees their own. Everyone else sees open seshes whose host is
-- still verified, so an expired host's sesh leaves the feed and returns on
-- renewal. The branch for people holding an RSVP arrives with rsvps (#8).
create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      host_id = (select auth.uid())
      or (status = 'open' and private.is_active_member(host_id))
    )
  );

create policy seshes_insert on public.seshes
  for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
    and private.open_sesh_count((select auth.uid())) < 5
  );

create policy seshes_update on public.seshes
  for update to authenticated
  using (
    host_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
  )
  with check (host_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Reading the address
-- ---------------------------------------------------------------------------

-- Host branch only in this migration. The guest branch — an approved RSVP, an
-- open sesh, within 12 hours of the start — lands in #8.
--
-- The host branch carries no time check and no cancelled check on purpose: a
-- host must be able to load their own edit screen after the sesh has started
-- or been cancelled, and hiding a host's own address from them protects
-- nobody. It ends when the 7-day wipe (#10) deletes the data.
create or replace function private.can_see_address(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member(p_user)
     and exists (
       select 1 from public.seshes s
       where s.id = p_sesh and s.host_id = p_user
     );
$$;

revoke execute on function private.can_see_address(uuid, uuid) from public, anon;
grant execute on function private.can_see_address(uuid, uuid) to authenticated, service_role;

-- Returns no rows when the caller may not read it. That is the locked state,
-- and it is not an error: the screen renders a locked card from an empty
-- result rather than deciding anything itself.
create or replace function public.sesh_address(p_sesh uuid)
returns table (
  address_line text,
  unit_note text,
  gate_code text,
  exact_lat double precision,
  exact_lng double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.address_line, s.unit_note, s.gate_code, s.exact_lat, s.exact_lng
  from public.seshes s
  where s.id = p_sesh
    and private.can_see_address(p_sesh, (select auth.uid()));
$$;

revoke execute on function public.sesh_address(uuid) from public, anon;
grant execute on function public.sesh_address(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes — every foreign key, and every column a policy reads.
-- ---------------------------------------------------------------------------

create index seshes_host_id_idx on public.seshes (host_id);
create index seshes_starts_at_idx on public.seshes (starts_at);
create index seshes_sesh_type_idx on public.seshes (sesh_type);
create index seshes_status_idx on public.seshes (status);
create index seshes_fuzzy_point_idx on public.seshes (fuzzy_lat, fuzzy_lng);

-- Serves private.open_sesh_count directly.
create index seshes_host_open_idx on public.seshes (host_id, starts_at) where status = 'open';
