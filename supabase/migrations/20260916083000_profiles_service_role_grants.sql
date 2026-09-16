-- service_role needs table privileges on public.profiles.
--
-- This project has "Automatically expose new tables" OFF, so nothing is
-- granted to anyone by default — including service_role. That was the whole
-- reason to turn it off, and the cost is that every new table needs this line.
--
-- The trap: service_role carries the BYPASSRLS attribute, so it is easy to
-- assume it can reach anything. BYPASSRLS skips row-level POLICIES. It does
-- not skip table PRIVILEGES, which are a separate check and run first. Without
-- the grant below, the verification flow, the expiry sweep and the admin panel
-- all fail with 42501 the first time they touch a profile.
--
-- Caught by supabase/tests/__tests__/profiles-rls.test.ts, which exercises the
-- service-role path rather than assuming it.
--
-- EVERY FUTURE TABLE IN THIS PROJECT NEEDS ITS OWN VERSION OF THIS GRANT.

grant all on public.profiles to service_role;
