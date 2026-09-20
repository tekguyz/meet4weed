-- ---------------------------------------------------------------------------
-- Fix for 20260919120000_seshes.sql.
--
-- pgcrypto ships hmac(text, text, text) and hmac(bytea, bytea, text). The
-- first version passed a text message with a bytea key, which matches neither,
-- so every insert failed with 42883.
--
-- The message is encoded to bytea rather than the pepper being cast down to
-- text: a 32-byte random key is not valid UTF-8, and text-casting it would
-- mangle the key rather than fail loudly.
--
-- Caught by supabase/tests/__tests__/sesh-fuzz.test.ts before anything else
-- used the function. The migration above is left as applied, because it is
-- already on the hosted project and the owner has a second machine that would
-- skip an edited file it had already recorded.
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
    convert_to(round(p_lat::numeric, 4)::text || ',' || round(p_lng::numeric, 4)::text, 'UTF8'),
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
