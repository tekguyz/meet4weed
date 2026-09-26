-- Meet4Weed — notifications (issue #50, Plan 05 migration 1 of 3)
--
-- A Notification is one thing that happened, addressed to one member (see
-- CONTEXT.md). Seven types, fixed by spec §5.
--
-- Server actions write these rows through service_role; no trigger does. A
-- trigger cannot know the human words for a row, cannot be switched off in a
-- test, and hides the fan-out from anyone reading the action.
--
-- A member reads their own rows and marks them read. That is all:
--   * no INSERT — a member cannot forge a notice to anyone, themselves included;
--   * no DELETE — deleting belongs to the reaper (#55). A member who could
--     delete could erase the record of a kick;
--   * UPDATE of read_at only, by column grant, so no other column can be
--     talked around.
--
-- The actor is an id, never a copied handle: the feed looks the handle up when
-- it renders, so a handle change (#70) never leaves an old name behind. A
-- deleted actor leaves the row standing with a null actor, and the feed says
-- "A member". A deleted recipient takes their own rows with them.

create type public.notification_type as enum (
  'rsvp_requested',
  'rsvp_approved',
  'rsvp_denied',
  'sesh_edited',
  'sesh_cancelled',
  'sesh_reminder',
  'card_expiry'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  -- Null for card_expiry, which is about no sesh.
  sesh_id uuid references public.seshes (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  -- Display scraps only. Anything filtered or joined on gets a real column.
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'One row per event per recipient. Written by server actions through service_role. Members read their own and set read_at.';

-- Serves the SELECT policy, the feed (newest first) and the recipient FK.
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_sesh_id_idx on public.notifications (sesh_id);
create index notifications_actor_id_idx on public.notifications (actor_id);

-- ---------------------------------------------------------------------------
-- Privileges. "Automatically expose new tables" is OFF, so nothing is granted
-- by default — service_role included.
-- ---------------------------------------------------------------------------

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. Enabled, never forced.
--
-- No can_browse() gate: an expired member is read-only, not shut out, and
-- still reads their feed.
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
