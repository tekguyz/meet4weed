-- ---------------------------------------------------------------------------
-- Owner feedback on PR #17: "Why are there values in kilometers? This is in
-- America, where this app will be used. We use miles here."
--
-- The threshold that decides whether a host has "moved" a sesh was a
-- kilometre. A kilometre is not a number anybody in Florida reasons in, and
-- 0.62 of a mile is not a rule anybody would choose on purpose.
--
-- It becomes ONE MILE. This changes behaviour, not just wording: a sesh that
-- moves 1.2 km used to stamp and now does not. That is the intended reading of
-- the feedback — the rule should be a round American number.
--
-- The hour is unchanged; an hour is an hour.
--
-- The circle itself is NOT changed. 400 m of radius is already about half a
-- mile across, which is the size the owner approved — only the words
-- describing it were metric, and those are fixed in the components.
-- ---------------------------------------------------------------------------

create or replace function public.seshes_stamp_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_metres double precision;
  -- One mile. The maths stays in metres because that is what the coordinate
  -- conversion produces; only the threshold is expressed in the unit a
  -- Florida member actually thinks in.
  v_mile constant double precision := 1609.344;
begin
  if old.exact_lat is not null and new.exact_lat is not null
     and (new.exact_lat is distinct from old.exact_lat or new.exact_lng is distinct from old.exact_lng) then
    v_metres := sqrt(
      power((new.exact_lat - old.exact_lat) * 111320.0, 2) +
      power((new.exact_lng - old.exact_lng) * 111320.0 * cos(radians(old.exact_lat)), 2)
    );
    if v_metres > v_mile then
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

comment on column public.seshes.materially_changed_at is
  'Derived. Stamped by the trigger when the pin moves over a mile or the start moves over an hour.';
