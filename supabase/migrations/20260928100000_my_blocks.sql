-- Meet4Weed — Me -> Blocked (issue #112, Plan 06 step 2 of 7)
--
-- The list of members the caller has blocked. It needs each blocked member's
-- handle, and the wall hides exactly that profile from the caller — the
-- profiles select policy returns no row across a block. So the list cannot be
-- a join through the normal policy; it is a SECURITY DEFINER function that
-- reads the caller's own block rows and returns only what the list shows.
--
-- What it returns is the least a row needs: the id to unblock, the handle and
-- display name to name them, the avatar seed to draw them. No card field, no
-- status, no bio. The function hands the caller nothing about anybody they
-- have not blocked themself: a block the other member placed is not theirs to
-- see (blocks_select_own says the same).
--
-- Unblock is unblock_member() from …_blocks.sql, unchanged: it deletes the
-- caller's own row and touches no RSVP.

create or replace function public.my_blocks()
returns table (
  member_id uuid,
  handle text,
  display_name text,
  avatar_seed text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.avatar_seed, b.created_at
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = (select auth.uid())
     and private.same_realm(b.is_demo)
   order by b.created_at desc, p.handle;
$$;

revoke execute on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

comment on function public.my_blocks() is
  'The caller''s own blocks, newest first, with the handle the wall hides. For Me -> Blocked. Issue #112.';
