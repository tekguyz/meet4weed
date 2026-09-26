-- Meet4Weed — push subscriptions (issue #56, Plan 05 migration 3 of 3)
--
-- A Push subscription is one browser on one device that agreed to receive
-- push (see CONTEXT.md): the push service's endpoint URL plus the two keys
-- the payload is encrypted with.
--
-- It is a tracking handle, so it is WRITE-ONLY to the member:
--   * INSERT: their own rows only;
--   * DELETE: their own rows only;
--   * SELECT: nobody but service_role. "Are notifications on?" is answered on
--     the device by pushManager.getSubscription(), never by reading this back.
--
-- One consequence is deliberate: a member cannot DELETE ... WHERE endpoint =
-- x through the Data API, because a WHERE clause reads the row and there is
-- no SELECT to read it with (and pg_safeupdate refuses a DELETE with no WHERE
-- at all). The delete policy is the backstop, not a path. The app therefore saves and forgets one device's
-- row in a server action (lib/notify/push-subscriptions.ts), scoped to the
-- signed-in member, with the admin client. The member grants below are the
-- limit on what the public key can do directly, not the app's own path.
--
-- An endpoint is a URL the server will POST to. The check keeps it https, so
-- a member cannot aim the server at a private address; the sender reads only
-- a member's newest few rows, so a member cannot make one notice fan out into
-- thousands of requests.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique
    check (endpoint ~ '^https://' and char_length(endpoint) <= 1024),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 256),
  user_agent text check (char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  -- Moved on every save from the device, so the newest rows are the live ones.
  updated_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'One browser on one device that accepted push. Members insert and delete their own; only service_role selects.';

-- Serves the INSERT/DELETE policies, the member FK, and the sender's
-- "newest few per member" read.
create index push_subscriptions_member_updated_idx on public.push_subscriptions (member_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Privileges. "Automatically expose new tables" is OFF, so nothing is granted
-- by default — service_role included. No SELECT for authenticated, on any
-- column.
-- ---------------------------------------------------------------------------

grant insert (member_id, endpoint, p256dh, auth, user_agent) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. Enabled, never forced. No SELECT policy, so even a
-- column grant added later by mistake would return no rows.
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (member_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (member_id = (select auth.uid()));
