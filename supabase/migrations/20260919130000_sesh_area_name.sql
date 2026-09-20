-- ---------------------------------------------------------------------------
-- Plan 03, ticket #5 — the area name.
--
-- A short public label for roughly where a sesh is: "Riverside", "South
-- Tampa". Filled in when a sesh is saved, by asking OpenStreetMap about the
-- FUZZY point — never the exact address. See lib/sesh/area-name.ts.
--
-- It is an ordinary public column: readable by anyone who can see the sesh,
-- writable by its host. The 40-character limit is the backstop for a host
-- pasting their street into a field the whole app can read. The form warns
-- first; this refuses.
--
-- No INSERT grant. The fuzzy point is written by a trigger, so it does not
-- exist until the row does — the create action inserts, reads the circle back,
-- looks the name up, then updates. One path, whether the name was looked up or
-- typed by the host.
-- ---------------------------------------------------------------------------

alter table public.seshes add column area_name text;

alter table public.seshes
  add constraint seshes_area_name_length
  check (area_name is null or char_length(area_name) <= 40);

comment on column public.seshes.area_name is
  'Public. Derived from the fuzzy point, never from the exact address.';

grant select (area_name) on public.seshes to authenticated;
grant update (area_name) on public.seshes to authenticated;
