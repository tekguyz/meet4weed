-- Meet4Weed — the demo cast (issue #39)
--
-- The invented members and seshes of the demo realm. See CONTEXT.md (Cast)
-- and docs/adr/0003-demo-visitors-over-a-shared-cast.md.
--
-- NOT A MIGRATION. It is data, re-applied by hand when it changes:
--
--   npm run demo:cast
--
-- RE-RUNNABLE. Everything upserts by a fixed id, so running it twice leaves
-- the same state, and a half-finished run is finished by running it again. It
-- never deletes, so it never touches a visitor's rows.
--
-- NOTHING HERE IS REAL.
--   * Members have no password and no email, so none of them can sign in.
--   * Cities are real; every street name is invented, so no real home or
--     business is named. Each pin sits on a public park in the right town,
--     never on a house.
--   * Avatars are drawn from the handle. No photographs, nothing like a face.
--
-- Sesh times live in public.cast_schedule as a day offset from Florida's
-- today and a wall-clock time. The last line calls shift_demo_cast(), which
-- the nightly sweep calls too, so both compute dates from the same numbers.

begin;

-- ---------------------------------------------------------------------------
-- Members. The signup trigger makes each profile; the update below fills it.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_anonymous, is_sso_user,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
select
  id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, null,
  '{"provider":"demo-cast"}'::jsonb, '{}'::jsonb, false, false,
  '', '', '', '',
  now(), now()
from (values
  ('ca570001-0000-4000-8000-000000000000'::uuid), ('ca570002-0000-4000-8000-000000000000'::uuid),
  ('ca570003-0000-4000-8000-000000000000'::uuid), ('ca570004-0000-4000-8000-000000000000'::uuid),
  ('ca570005-0000-4000-8000-000000000000'::uuid), ('ca570006-0000-4000-8000-000000000000'::uuid),
  ('ca570007-0000-4000-8000-000000000000'::uuid), ('ca570008-0000-4000-8000-000000000000'::uuid),
  ('ca570009-0000-4000-8000-000000000000'::uuid), ('ca570010-0000-4000-8000-000000000000'::uuid),
  ('ca570011-0000-4000-8000-000000000000'::uuid), ('ca570012-0000-4000-8000-000000000000'::uuid),
  ('ca570013-0000-4000-8000-000000000000'::uuid), ('ca570014-0000-4000-8000-000000000000'::uuid),
  ('ca570015-0000-4000-8000-000000000000'::uuid), ('ca570016-0000-4000-8000-000000000000'::uuid),
  ('ca570017-0000-4000-8000-000000000000'::uuid), ('ca570018-0000-4000-8000-000000000000'::uuid),
  ('ca570019-0000-4000-8000-000000000000'::uuid), ('ca570020-0000-4000-8000-000000000000'::uuid),
  ('ca570021-0000-4000-8000-000000000000'::uuid), ('ca570022-0000-4000-8000-000000000000'::uuid),
  ('ca570023-0000-4000-8000-000000000000'::uuid), ('ca570024-0000-4000-8000-000000000000'::uuid)
) as cast_ids (id)
on conflict (id) do nothing;

update public.profiles p
   set is_demo = true,
       handle = v.handle,
       display_name = v.display_name,
       city = v.city,
       bio = v.bio,
       strain_prefs = v.strain_prefs::public.strain_type[],
       method_prefs = v.method_prefs::public.consumption_method[],
       vibe_tags = v.vibe_tags,
       avatar_seed = v.handle,
       status = 'verified',
       card_expires_on = private.florida_today() + 365,
       attested_at = coalesce(p.attested_at, now()),
       terms_version = 'demo-cast'
  from (values
    ('ca570001-0000-4000-8000-000000000000'::uuid, 'palmfrond_rae', 'Rae', 'Fort Lauderdale',
     'Pour-over coffee, porch light, slow conversations. Chronic back pain, so I like a comfortable chair.',
     '{indica,hybrid}', '{flower,vape}', array['coffee', 'porch hangs', 'podcasts']),
    ('ca570002-0000-4000-8000-000000000000'::uuid, 'wiltonwill', 'Will', 'Wilton Manors',
     'Record collector. Will play your request if it is on vinyl.',
     '{hybrid}', '{flower}', array['vinyl', 'jazz', 'cooking']),
    ('ca570003-0000-4000-8000-000000000000'::uuid, 'mangolassi', 'Priya', 'Miami',
     'Nurse on night shifts. Here for quiet company on my days off.',
     '{indica}', '{edibles}', array['books', 'tea', 'early nights']),
    ('ca570004-0000-4000-8000-000000000000'::uuid, 'southbeach_sol', 'Sol', 'Miami Beach',
     'Sunsets over the bay, a speaker with too much bass, and good people.',
     '{sativa,hybrid}', '{vape,flower}', array['sunsets', 'house music']),
    ('ca570005-0000-4000-8000-000000000000'::uuid, 'hollywood_hank', 'Hank', 'Hollywood',
     'Retired machinist. Arthritis in both hands. Excellent at dominoes, worse at losing.',
     '{indica}', '{edibles,vape}', array['dominoes', 'fishing']),
    ('ca570006-0000-4000-8000-000000000000'::uuid, 'bocabreeze', 'Dana', 'Boca Raton',
     'Gardener. Ask me about growing tomatoes in sand.',
     '{hybrid}', '{flower}', array['gardening', 'documentaries']),
    ('ca570007-0000-4000-8000-000000000000'::uuid, 'lasolas_luz', 'Luz', 'Fort Lauderdale',
     'Graphic designer. I will bring snacks nobody asked for.',
     '{sativa}', '{vape}', array['design', 'snacks', 'karaoke']),
    ('ca570008-0000-4000-8000-000000000000'::uuid, 'vinyl_marco', 'Marco', 'Wilton Manors',
     'Bass player, amateur chef, still learning to relax.',
     '{hybrid}', '{flower,dabs}', array['music', 'cooking']),
    ('ca570009-0000-4000-8000-000000000000'::uuid, 'kayak_kim', 'Kim', 'Fort Lauderdale',
     'Out on the water most mornings. Anxiety management, one paddle at a time.',
     '{sativa,hybrid}', '{vape}', array['kayaking', 'birding', 'mornings']),
    ('ca570010-0000-4000-8000-000000000000'::uuid, 'gamenight_gus', 'Gus', 'Hollywood',
     'Owns too many board games. Will teach you any of them.',
     '{hybrid}', '{edibles}', array['board games', 'puzzles']),
    ('ca570011-0000-4000-8000-000000000000'::uuid, 'ines_paints', 'Inés', 'Miami',
     'Watercolors, big windows, bossa nova on low.',
     '{sativa}', '{flower}', array['painting', 'bossa nova']),
    ('ca570012-0000-4000-8000-000000000000'::uuid, 'tidepool_tom', 'Tom', 'Miami Beach',
     'Marine biology teacher. I have opinions about sea turtles.',
     '{indica}', '{vape}', array['snorkeling', 'science']),
    ('ca570013-0000-4000-8000-000000000000'::uuid, 'sunsetsage', 'Sage', 'Boca Raton',
     'Nature documentaries and a blanket. That is the whole plan.',
     '{indica}', '{edibles,flower}', array['documentaries', 'blankets']),
    ('ca570014-0000-4000-8000-000000000000'::uuid, 'porchlight_pat', 'Pat', 'Fort Lauderdale',
     'New to the area. Migraines, mostly under control. Friendly, a little shy.',
     '{hybrid}', '{vape}', array['walking', 'trivia']),
    ('ca570015-0000-4000-8000-000000000000'::uuid, 'hammock_jo', 'Jo', 'Wilton Manors',
     'Two hammocks, one mango tree, no schedule.',
     '{indica,hybrid}', '{flower}', array['hammocks', 'reading']),
    ('ca570016-0000-4000-8000-000000000000'::uuid, 'littlehavana_leo', 'Leo', 'Miami',
     'Cafecito at three, dominoes at four. Born and raised on Calle Ocho.',
     '{hybrid}', '{flower}', array['dominoes', 'cafecito', 'baseball']),
    ('ca570017-0000-4000-8000-000000000000'::uuid, 'reefwalker', 'Nia', 'Hollywood',
     'Beach cleanups on weekends. Chronic pain after a car accident.',
     '{sativa}', '{vape,edibles}', array['beach', 'volunteering']),
    ('ca570018-0000-4000-8000-000000000000'::uuid, 'couchcinema', 'Ben', 'Fort Lauderdale',
     'Collector of bad movies. The worse, the better.',
     '{indica}', '{flower}', array['movies', 'popcorn']),
    ('ca570019-0000-4000-8000-000000000000'::uuid, 'gardenvera', 'Vera', 'Boca Raton',
     'Retired art teacher. My garden is my studio now.',
     '{hybrid}', '{edibles}', array['painting', 'gardening']),
    ('ca570020-0000-4000-8000-000000000000'::uuid, 'bossa_nova_ana', 'Ana', 'Miami Beach',
     'Amateur astronomer with a rooftop and a telescope.',
     '{sativa,hybrid}', '{vape}', array['stargazing', 'guitar']),
    ('ca570021-0000-4000-8000-000000000000'::uuid, 'chesspiece_cy', 'Cy', 'Miami',
     'Chess in the park. Losing is how you learn.',
     '{hybrid}', '{flower}', array['chess', 'jazz']),
    ('ca570022-0000-4000-8000-000000000000'::uuid, 'moonbeam_mo', 'Mo', 'Hollywood',
     'Night owl, film photographer, good listener.',
     '{indica}', '{flower,vape}', array['photography', 'late nights']),
    ('ca570023-0000-4000-8000-000000000000'::uuid, 'riverwalk_ray', 'Ray', 'Fort Lauderdale',
     'Veteran. PTSD, sleeping better these days. Walks the river most evenings.',
     '{indica}', '{edibles}', array['walking', 'grilling']),
    ('ca570024-0000-4000-8000-000000000000'::uuid, 'banyan_bea', 'Bea', 'Boca Raton',
     'Yoga in the morning, crosswords at night.',
     '{hybrid}', '{vape}', array['yoga', 'crosswords'])
  ) as v (id, handle, display_name, city, bio, strain_prefs, method_prefs, vibe_tags)
 where p.id = v.id;

-- ---------------------------------------------------------------------------
-- Seshes. starts_at is a placeholder until shift_demo_cast() runs below.
-- area_name is written here; for a real sesh the area-name service fills it.
-- ---------------------------------------------------------------------------

insert into public.seshes (
  id, host_id, title, description, sesh_type, starts_at, capacity, status, visibility,
  exact_lat, exact_lng, address_line, unit_note, gate_code, area_name
)
values
  -- The unlock sesh: every new visitor is an approved guest of this one.
  ('ca575e55-0000-4000-8000-000000000001', 'ca570001-0000-4000-8000-000000000000',
   'Porch hang and pour-over',
   'Slow evening on the porch. I brew, you pick the playlist. Comfortable chairs, low lights, early finish.',
   'chill', now(), 8, 'open', 'listed',
   26.13520, -80.13080, '1418 Coquina Way, Fort Lauderdale, FL 33304', 'Porch around the side', 'Blue door', 'Victoria Park'),
  ('ca575e55-0000-4000-8000-000000000002', 'ca570002-0000-4000-8000-000000000000',
   'Vinyl night on the back patio',
   'Bring a record if you have one. Jazz first, then whatever the room wants.',
   'chill', now(), 6, 'open', 'listed',
   26.14400, -80.13000, '2207 Seagrape Terrace, Wilton Manors, FL 33305', null, null, 'Wilton Manors'),
  ('ca575e55-0000-4000-8000-000000000003', 'ca570016-0000-4000-8000-000000000000',
   'Dominoes and cafecito',
   'Two tables, strong coffee, friendly trash talk. Beginners welcome.',
   'game_night', now(), 6, 'open', 'listed',
   25.76550, -80.21900, '845 Guava Row, Miami, FL 33135', 'Back courtyard', null, 'Little Havana'),
  ('ca575e55-0000-4000-8000-000000000004', 'ca570004-0000-4000-8000-000000000000',
   'Sunset circle by the bay',
   'Balcony facing the bay. We watch the sun go down and keep it mellow.',
   'smoke_circle', now(), 10, 'open', 'listed',
   25.78220, -80.13680, '1530 Marlin Crest Drive, Miami Beach, FL 33139', 'Unit 4B', null, 'Flamingo Park'),
  ('ca575e55-0000-4000-8000-000000000005', 'ca570010-0000-4000-8000-000000000000',
   'Board game marathon',
   'Catan, Wingspan, and whatever you bring. Snacks provided, seats limited.',
   'game_night', now(), 6, 'open', 'listed',
   26.01130, -80.14430, '319 Pelican Bend, Hollywood, FL 33020', null, '4417', 'Downtown Hollywood'),
  ('ca575e55-0000-4000-8000-000000000006', 'ca570019-0000-4000-8000-000000000000',
   'Garden paint and puff',
   'Easels in the garden, paper and paint provided. No skill needed.',
   'creative', now(), 6, 'open', 'listed',
   26.35710, -80.10430, '7702 Sea Oat Lane, Boca Raton, FL 33431', null, null, 'Boca Raton'),
  ('ca575e55-0000-4000-8000-000000000007', 'ca570009-0000-4000-8000-000000000000',
   'Kayak launch, then snacks',
   'Easy paddle on calm water, then breakfast on the dock. Two spare kayaks.',
   'outdoors', now(), 4, 'open', 'listed',
   26.14070, -80.10500, '930 Heron Point Road, Fort Lauderdale, FL 33304', null, null, 'Birch State Park'),
  ('ca575e55-0000-4000-8000-000000000008', 'ca570011-0000-4000-8000-000000000000',
   'Studio sketch night',
   'Big windows, soft music, sketchbooks on the table. Draw or just watch.',
   'creative', now(), 5, 'open', 'listed',
   25.80270, -80.19850, '2611 Mural Alley, Miami, FL 33127', 'Second floor studio', null, 'Wynwood'),
  ('ca575e55-0000-4000-8000-000000000009', 'ca570018-0000-4000-8000-000000000000',
   'Bad movie double feature',
   'Two of the worst films ever made, back to back. Heckling encouraged.',
   'movie_night', now(), 8, 'open', 'listed',
   26.11900, -80.14400, '604 Riverbank Court, Fort Lauderdale, FL 33301', null, null, 'Riverwalk'),
  -- Unlisted: only the host and people holding an RSVP see it.
  ('ca575e55-0000-4000-8000-000000000010', 'ca570017-0000-4000-8000-000000000000',
   'Beach cleanup, then a slow afternoon',
   'An hour of cleanup, then shade, cold drinks and nowhere to be.',
   'outdoors', now(), 6, 'open', 'unlisted',
   26.03350, -80.11550, '1122 Dune Walk, Hollywood, FL 33019', null, null, 'Hollywood Beach'),
  -- Past, so the history screens have something in them.
  ('ca575e55-0000-4000-8000-000000000011', 'ca570015-0000-4000-8000-000000000000',
   'Hammock hour',
   'Two hammocks, one mango tree. Bring a book or do nothing at all.',
   'chill', now(), 4, 'open', 'listed',
   26.15900, -80.14150, '318 Mango Shade Lane, Wilton Manors, FL 33311', null, null, 'Wilton Manors'),
  ('ca575e55-0000-4000-8000-000000000012', 'ca570013-0000-4000-8000-000000000000',
   'Nature docs and blankets',
   'A projector, a pile of blankets and the best nature series ever filmed.',
   'movie_night', now(), 6, 'open', 'listed',
   26.33450, -80.07050, '1790 Sandpiper Circle, Boca Raton, FL 33432', null, null, 'Boca Raton'),
  -- Cancelled, so a visitor sees how the app shows one.
  ('ca575e55-0000-4000-8000-000000000013', 'ca570020-0000-4000-8000-000000000000',
   'Rooftop stargazing',
   'Telescope on the roof if the sky is clear. Called off: the forecast says storms.',
   'chill', now(), 6, 'cancelled', 'listed',
   25.76510, -80.13330, '101 Lighthouse Row, Miami Beach, FL 33139', 'Roof access by the stairs', null, 'South Pointe')
on conflict (id) do update
   set title = excluded.title,
       description = excluded.description,
       sesh_type = excluded.sesh_type,
       capacity = excluded.capacity,
       status = excluded.status,
       visibility = excluded.visibility,
       exact_lat = excluded.exact_lat,
       exact_lng = excluded.exact_lng,
       address_line = excluded.address_line,
       unit_note = excluded.unit_note,
       gate_code = excluded.gate_code,
       area_name = excluded.area_name;

insert into public.cast_schedule (sesh_id, day_offset, local_time, is_unlock)
values
  ('ca575e55-0000-4000-8000-000000000001', 2, '19:30', true),
  ('ca575e55-0000-4000-8000-000000000002', 1, '20:00', false),
  ('ca575e55-0000-4000-8000-000000000003', 3, '16:00', false),
  ('ca575e55-0000-4000-8000-000000000004', 4, '18:30', false),
  ('ca575e55-0000-4000-8000-000000000005', 5, '18:00', false),
  ('ca575e55-0000-4000-8000-000000000006', 6, '15:00', false),
  ('ca575e55-0000-4000-8000-000000000007', 8, '09:30', false),
  ('ca575e55-0000-4000-8000-000000000008', 9, '19:30', false),
  ('ca575e55-0000-4000-8000-000000000009', 10, '20:00', false),
  ('ca575e55-0000-4000-8000-000000000010', 12, '10:00', false),
  ('ca575e55-0000-4000-8000-000000000011', -2, '17:00', false),
  ('ca575e55-0000-4000-8000-000000000012', -5, '20:00', false),
  ('ca575e55-0000-4000-8000-000000000013', 7, '21:00', false)
on conflict (sesh_id) do update
   set day_offset = excluded.day_offset,
       local_time = excluded.local_time,
       is_unlock = excluded.is_unlock;

-- ---------------------------------------------------------------------------
-- Guests. Approved cast guests fill the seat counts and the guest lists; a
-- few requests sit waiting so a host's view has something to decide.
-- ---------------------------------------------------------------------------

insert into public.rsvps (sesh_id, member_id, status, decided_at)
select v.sesh_id::uuid, v.member_id::uuid, v.status::public.rsvp_status,
       case when v.status = 'requested' then null else now() end
  from (values
    ('ca575e55-0000-4000-8000-000000000001', 'ca570007-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000001', 'ca570009-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000001', 'ca570014-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000002', 'ca570008-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000002', 'ca570015-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000002', 'ca570022-0000-4000-8000-000000000000', 'requested'),
    ('ca575e55-0000-4000-8000-000000000003', 'ca570021-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000003', 'ca570005-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000004', 'ca570012-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000004', 'ca570020-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000004', 'ca570003-0000-4000-8000-000000000000', 'requested'),
    ('ca575e55-0000-4000-8000-000000000005', 'ca570017-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000005', 'ca570022-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000005', 'ca570005-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000006', 'ca570006-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000006', 'ca570024-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000007', 'ca570023-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000008', 'ca570003-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000009', 'ca570014-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000009', 'ca570007-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000009', 'ca570018-0000-4000-8000-000000000000', 'requested'),
    ('ca575e55-0000-4000-8000-000000000010', 'ca570010-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000011', 'ca570002-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000011', 'ca570008-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000012', 'ca570006-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000012', 'ca570019-0000-4000-8000-000000000000', 'approved'),
    ('ca575e55-0000-4000-8000-000000000013', 'ca570012-0000-4000-8000-000000000000', 'approved')
  ) as v (sesh_id, member_id, status)
on conflict on constraint rsvps_one_per_member do update
   set status = excluded.status,
       decided_at = excluded.decided_at;

-- ---------------------------------------------------------------------------
-- The on-deck lists, on a few upcoming seshes.
-- ---------------------------------------------------------------------------

insert into public.contributions (id, sesh_id, member_id, kind, label, strain_type)
values
  ('ca57b123-0000-4000-8000-000000000001', 'ca575e55-0000-4000-8000-000000000001', 'ca570007-0000-4000-8000-000000000000', 'item', 'Guava pastries', null),
  ('ca57b123-0000-4000-8000-000000000002', 'ca575e55-0000-4000-8000-000000000001', 'ca570009-0000-4000-8000-000000000000', 'strain', 'Something mellow for the porch', 'indica'),
  ('ca57b123-0000-4000-8000-000000000003', 'ca575e55-0000-4000-8000-000000000001', 'ca570014-0000-4000-8000-000000000000', 'none', null, null),
  ('ca57b123-0000-4000-8000-000000000004', 'ca575e55-0000-4000-8000-000000000003', 'ca570021-0000-4000-8000-000000000000', 'item', 'Pastelitos', null),
  ('ca57b123-0000-4000-8000-000000000005', 'ca575e55-0000-4000-8000-000000000005', 'ca570017-0000-4000-8000-000000000000', 'item', 'Wingspan and the expansion', null),
  ('ca57b123-0000-4000-8000-000000000006', 'ca575e55-0000-4000-8000-000000000005', 'ca570022-0000-4000-8000-000000000000', 'item', 'Chips and salsa', null),
  ('ca57b123-0000-4000-8000-000000000007', 'ca575e55-0000-4000-8000-000000000006', 'ca570024-0000-4000-8000-000000000000', 'strain', 'A hybrid to share', 'hybrid'),
  ('ca57b123-0000-4000-8000-000000000008', 'ca575e55-0000-4000-8000-000000000009', 'ca570014-0000-4000-8000-000000000000', 'item', 'Popcorn, the good kind', null)
on conflict (id) do update
   set kind = excluded.kind,
       label = excluded.label,
       strain_type = excluded.strain_type;

-- ---------------------------------------------------------------------------
-- Dates, cards. The same call the nightly sweep makes.
-- ---------------------------------------------------------------------------

select public.shift_demo_cast() as cast_seshes_moved;

commit;
