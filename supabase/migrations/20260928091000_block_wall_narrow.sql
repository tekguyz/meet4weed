-- Meet4Weed — the block wall, two fixes from review (issue #111)
--
-- A separate file because …_blocks.sql has already been applied to the
-- linked project, and an applied migration is history rather than a draft.
--
-- 1. private.in_same_room was too wide. It let a profile through the wall
--    for ANY approved RSVP the two ever shared at a third member's sesh, past
--    ones included — and RSVPs outlive the seven-day wipe (ADR 0004), so
--    that hole never closed. It undid "their profile disappears for me" and
--    "a blocked actor reads as 'A member'" for anybody who had once been at
--    the same party. Now it counts only a sesh that is still open and not
--    over: the same 12-hour tail the address unlock uses. Once the night is
--    done, the wall is whole again.
--
-- 2. public.invite_preview was not walled. A blocked member holding the
--    blocker's link still saw the sesh's title and start time. The preview
--    runs as the member when they are signed in (lib/sesh/invite-reads.ts),
--    so auth.uid() is there to check. Signed out, the server reads it with
--    service_role and auth.uid() is null, which is behind no wall; a
--    signed-out visitor is nobody's blocked member.

create or replace function private.in_same_room(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.rsvps ra
      join public.rsvps rb on rb.sesh_id = ra.sesh_id
      join public.seshes s on s.id = ra.sesh_id
     where ra.member_id = p_a
       and ra.status = 'approved'
       and rb.member_id = p_b
       and rb.status = 'approved'
       and s.host_id <> p_a
       and s.host_id <> p_b
       and s.status = 'open'
       and now() < s.starts_at + interval '12 hours'
  );
$$;

create or replace function public.invite_preview(p_token_hash text)
returns table (title text, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.title, s.starts_at
    from public.invites i
    join public.seshes s on s.id = i.sesh_id
   where i.token_hash = p_token_hash
     and private.invite_is_live(i)
     and private.sesh_takes_invites(s)
     and not private.is_blocked_between(s.host_id, (select auth.uid()));
$$;
