-- Meet4Weed — who may read a profile (issue #64)
--
-- Until now any signed-in member read any profile, including somebody who
-- signed up five minutes ago and never showed a card. The profile page at
-- /m/[handle] would make that a directory any unverified sign-up could walk,
-- so the rule tightens before the page ships.
--
-- A row is readable by:
--
--   * its owner, always. Onboarding, verification and settings read the
--     member's own row before the card gate opens; without this branch a new
--     member could not finish signing up.
--   * a member who passes private.can_browse — verified or expired. Expired is
--     read-only, not shut out (spec §4.3), the same line every other read in
--     the app draws.
--   * an admin. lib/admin/queries.ts embeds profiles(handle) on each
--     submission in the review queue, read with the admin's own session. The
--     owner who reviews need not hold a card, and the queue must still say
--     whose card it is.
--
-- Nothing else changes. The UPDATE policy, the column grants and the table
-- grants in 20260916082218_profiles.sql stand as written.
--
-- Each call is wrapped in a subselect, as every earlier policy does, so it
-- runs once per statement rather than once per row.
--
-- Both helpers are SECURITY DEFINER owned by postgres and read public.profiles
-- themselves; RLS is enabled but not forced, so they do not recurse into this
-- policy. Both already have EXECUTE revoked from public and anon, and granted
-- to authenticated, which a policy needs because it runs as the caller.

drop policy profiles_select_authenticated on public.profiles;

create policy profiles_select_member
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.can_browse((select auth.uid()))
    or (select private.is_admin())
  );

-- The old comment said the table was the directory any member reads. It no
-- longer is; say what it is now.
comment on table public.profiles is
  'Member directory, readable by the owner, members who can browse, and admins. Card images and verification evidence live elsewhere.';

comment on policy profiles_select_member on public.profiles is
  'Own row always; others only for a member who can browse, or an admin. Issue #64.';
