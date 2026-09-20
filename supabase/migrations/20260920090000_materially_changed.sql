-- ---------------------------------------------------------------------------
-- Plan 03, ticket #9 — the host-changed stamp.
--
-- A host can approve five people and then drag the pin forty kilometres, or
-- shift the start by six hours. The approvals survive, which is right, but the
-- guests only find out if they happen to reopen the app — and somebody turns
-- up at a house that is no longer the sesh.
--
-- What counts as "moved" is decided here rather than in a screen, for the same
-- reason everything else is: a screen can be asked not to.
--
-- Real notifications are step 9 of the build order. This is the cheap cover
-- for the one case that actually strands somebody.
-- ---------------------------------------------------------------------------

alter table public.seshes add column materially_changed_at timestamptz;

comment on column public.seshes.materially_changed_at is
  'Derived. Stamped by the trigger when the pin moves over 1 km or the start moves over an hour.';

-- No write grant. Derived, like the fuzzy circle and the seat counter: a host
-- who could set it could hide a move, or fake one.

-- ---------------------------------------------------------------------------
-- What counts as a big change
--
-- A kilometre and an hour. Small edits — a typo, a different type, one more
-- guest, nudging the pin across the garden — stamp nothing, or the banner
-- cries wolf and people stop reading it.
--
-- Distance uses the same flat approximation as the fuzzing, which is about
-- 0.4% short at Florida's latitude. Immaterial against a 1 km threshold.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_stamp_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_metres double precision;
begin
  if old.exact_lat is not null and new.exact_lat is not null
     and (new.exact_lat is distinct from old.exact_lat or new.exact_lng is distinct from old.exact_lng) then
    v_metres := sqrt(
      power((new.exact_lat - old.exact_lat) * 111320.0, 2) +
      power((new.exact_lng - old.exact_lng) * 111320.0 * cos(radians(old.exact_lat)), 2)
    );
    if v_metres > 1000.0 then
      new.materially_changed_at := now();
      return new;
    end if;
  end if;

  if abs(extract(epoch from (new.starts_at - old.starts_at))) > 3600 then
    new.materially_changed_at := now();
    return new;
  end if;

  -- Nothing material moved, so the stamp is whatever it already was. Writing
  -- old's value back is also what stops a host setting it by hand.
  new.materially_changed_at := old.materially_changed_at;
  return new;
end;
$$;

revoke execute on function public.seshes_stamp_material_change() from public, anon, authenticated;

-- Runs after seshes_set_fuzzy, which is alphabetically earlier; neither reads
-- what the other writes, so the order does not matter.
create trigger seshes_stamp_material_change
  before update on public.seshes
  for each row execute function public.seshes_stamp_material_change();
