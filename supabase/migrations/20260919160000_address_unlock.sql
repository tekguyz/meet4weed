-- ---------------------------------------------------------------------------
-- Plan 03, ticket #8 — the address unlock.
--
-- This is the rule the whole plan exists for. A sesh happens at somebody's
-- home, and everything below is the difference between an app that keeps that
-- address and an app that publishes it.
--
-- It is decided HERE. Not in a screen, not in a server action, not in a
-- client. A screen that decides is a screen that can be asked not to.
--
-- Proved in supabase/tests/__tests__/sesh-address-unlock.test.ts, the file
-- spec §6.1 asks for by name.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Visibility: a cancelled sesh, and an expired host's sesh, stay readable to
-- the people holding a seat.
--
-- Without this a host cancels, the sesh vanishes, and an approved guest drives
-- to a dark house on Friday. It is SECURITY DEFINER because a policy on
-- `seshes` reading `rsvps` would otherwise run the rsvps policy, which itself
-- reads `seshes`.
-- ---------------------------------------------------------------------------

create or replace function private.has_rsvp(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rsvps r
    where r.sesh_id = p_sesh
      and r.member_id = p_user
      and r.status in ('approved', 'requested')
  );
$$;

revoke execute on function private.has_rsvp(uuid, uuid) from public, anon;
grant execute on function private.has_rsvp(uuid, uuid) to authenticated, service_role;

drop policy seshes_select on public.seshes;

create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      -- A host always sees their own.
      host_id = (select auth.uid())
      -- Anybody holding a seat keeps seeing it, cancelled or not, and whether
      -- or not the host's card has lapsed. The feed still hides both, because
      -- lib/sesh/queries.ts filters on status and start time.
      or private.has_rsvp(id, (select auth.uid()))
      -- The public feed.
      or (status = 'open' and private.is_active_member(host_id))
    )
  );

-- ---------------------------------------------------------------------------
-- The unlock itself
--
-- Two branches, and private.is_active_member gates both. That is what takes
-- the address back from a guest whose card lapses after they were approved —
-- verification is the gate AFTER approval as well as before it.
--
-- HOST branch: no time check, no cancelled check. A host must be able to open
-- their own edit screen after the sesh has run or been called off, and hiding
-- a host's own address from them protects nobody. It ends when the 7-day wipe
-- (#10) deletes the data.
--
-- GUEST branch: an approved RSVP, the sesh still open, and within 12 hours of
-- the start. Withdrawing, being removed, or the host cancelling all take it
-- back at once, because each one falsifies a line here.
--
-- There is NO admin branch. Adding one would put an exception in the single
-- rule this plan exists for, before anything needs the exception. If safety
-- reports in step 10 turn out to need it, it arrives then with an
-- admin_actions row per read — the shape decide_verification already uses.
-- ---------------------------------------------------------------------------

create or replace function private.can_see_address(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member(p_user)
     and exists (
       select 1
       from public.seshes s
       where s.id = p_sesh
         and (
           s.host_id = p_user
           or (
             s.status = 'open'
             and now() < s.starts_at + interval '12 hours'
             and exists (
               select 1
               from public.rsvps r
               where r.sesh_id = s.id
                 and r.member_id = p_user
                 and r.status = 'approved'
             )
           )
         )
     );
$$;

revoke execute on function private.can_see_address(uuid, uuid) from public, anon;
grant execute on function private.can_see_address(uuid, uuid) to authenticated, service_role;

comment on function private.can_see_address(uuid, uuid) is
  'The address rule. Host: unconditional. Guest: approved, sesh open, within 12h of the start. Both need a current card. No admin branch.';
