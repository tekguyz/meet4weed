-- Meet4Weed — notifications written by the clock (issue #55, Plan 05 migration 2 of 3)
--
-- The daily cron job writes sesh_reminder and card_expiry. A cron job can run
-- twice — a retry, or somebody running scripts/run-cron.mjs by hand — and a
-- second run must be invisible to a member.
--
-- A unique index enforces that. Code that checks first races; the database
-- does not. The writer upserts with ON CONFLICT DO NOTHING on this index.
--
-- dedup_key is set only on the clock-driven rows. The action rows leave it
-- null, and nulls are distinct in a unique index, so one member asking to
-- join twice is still two rows. The check keeps it that way.
--
-- No new function, no new policy, no new grant: the table-wide SELECT and the
-- service_role grant from migration 1 already cover the new column, and
-- authenticated can still UPDATE read_at and nothing else.

alter table public.notifications add column dedup_key text;

alter table public.notifications
  add constraint notifications_dedup_key_clock_only
  check (dedup_key is null or type in ('sesh_reminder', 'card_expiry'));

create unique index notifications_once_idx
  on public.notifications (recipient_id, type, dedup_key);

-- Serves the 90-day reaper, which deletes by age across every recipient.
create index notifications_created_at_idx on public.notifications (created_at);
