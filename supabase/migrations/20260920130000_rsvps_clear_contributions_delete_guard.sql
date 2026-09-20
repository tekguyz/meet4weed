-- ---------------------------------------------------------------------------
-- Plan 04, ticket #26 — follow-up to …_contributions.sql.
--
-- rsvps_clear_contributions fires on UPDATE **and** DELETE, and the first
-- version asked one question for both:
--
--   if old.status = 'approved' and (tg_op = 'DELETE' or new.status <> 'approved')
--
-- On the DELETE path that reads `new.status`, and a DELETE trigger has no NEW
-- record. It works today only because the OR happens to be short-circuited,
-- and Postgres does not promise to short-circuit a boolean expression. If it
-- ever stops, the failure is not cosmetic: "record new is not assigned yet"
-- would abort the DELETE, and an RSVP row could not be removed at all.
--
-- Split into two branches, so the DELETE path never mentions NEW. Covered by
-- "deletes them when the RSVP row itself is deleted" in
-- supabase/tests/__tests__/on-deck-rls.test.ts.
--
-- A separate file because …_contributions.sql has already been applied to the
-- linked project, and an applied migration is history rather than a draft.
-- ---------------------------------------------------------------------------

create or replace function public.rsvps_clear_contributions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lost_approval boolean;
begin
  if tg_op = 'DELETE' then
    v_lost_approval := old.status = 'approved';
  else
    v_lost_approval := old.status = 'approved' and new.status <> 'approved';
  end if;

  if v_lost_approval then
    delete from public.contributions c
     where c.sesh_id = old.sesh_id
       and c.member_id = old.member_id;
  end if;

  return null;
end;
$$;

revoke execute on function public.rsvps_clear_contributions() from public, anon, authenticated;
