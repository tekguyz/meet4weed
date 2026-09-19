-- Revoke EXECUTE on the two trigger functions from Plan 01.
--
-- Why: Postgres grants EXECUTE to PUBLIC on every new function, and this
-- project's rule is that every function revokes it again (CLAUDE.md, "Revoke
-- EXECUTE on every new function"). These two were missed, so Supabase's
-- database linter reports them as callable through
-- `/rest/v1/rpc/handle_new_user` with the anon key
-- (lint 0028/0029, observed 2026-09-19).
--
-- Exploitable today? No. Postgres refuses to call a function that returns
-- `trigger` except as a trigger, so the RPC fails before the body runs. This
-- migration closes the hole in the grant, not a live leak.
--
-- The triggers themselves keep working: a trigger runs as part of the
-- statement that fires it and does not need EXECUTE on the function.
--
-- `public.rls_auto_enable()`, also flagged by the same lint, is deliberately
-- left alone: nothing in this repo creates it, so it is not ours to drop.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
