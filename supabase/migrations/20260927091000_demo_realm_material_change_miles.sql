-- Meet4Weed — demo realm fix-up (issue #39)
--
-- 20260927090000_demo_realm.sql re-created seshes_stamp_material_change() to
-- skip the cast, but copied it from its FIRST version, with the 1 km
-- threshold. 20260920110000_material_change_in_miles.sql had already made it
-- one mile. sesh-rls.test.ts caught it. This puts the mile back and keeps the
-- cast skip.

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
  -- The nightly shift of a cast sesh is not "the host moved it" (#39).
  if new.is_demo and private.is_cast(new.host_id) then
    new.materially_changed_at := old.materially_changed_at;
    return new;
  end if;

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
