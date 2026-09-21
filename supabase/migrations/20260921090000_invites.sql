-- ---------------------------------------------------------------------------
-- Plan 04, ticket #30 — invites: mint and redeem.
--
-- A host hands somebody a link, and that person can ask to come. That is all
-- the link does. THE HOST STILL APPROVES, BY HAND. Redeeming writes a CLAIM,
-- never an RSVP, and a claim is never an input to private.can_see_address().
-- That function is not touched by this migration, and
-- supabase/tests/__tests__/invite-rls.test.ts re-asserts the whole shipped
-- unlock matrix (#8) with a claimant added to it.
--
-- THE TOKEN IS NEVER STORED. lib/sesh/invite-token.ts (#29) mints
-- base64url(16 random bytes) "." base64url(HMAC), and this schema only ever
-- sees sha256(token). Nothing here can hand a token back, because nothing
-- here ever had one: the host sees it once, in the reply to mint_invite, and
-- the column grant below makes token_hash unreadable to `authenticated` so
-- the host's own panel cannot build an href out of it either.
--
-- A USE IS SPENT BY A SIGNED-IN HUMAN PRESSING A BUTTON, NEVER BY A PAGE
-- LOAD. That is why there are two functions and not one: invite_preview()
-- reads a title and a start time and changes nothing, and redeem_invite()
-- spends. Every chat app fetches a pasted link to draw a preview card, and
-- one use is the default — a link that spent itself on that fetch would be
-- dead before the recipient ever saw it. app/auth/confirm/page.tsx already
-- solves exactly this for emailed auth links and carries the same note.
--
-- NO TABLE HERE TAKES A WRITE GRANT FOR `authenticated`. Minting, revoking
-- and redeeming are three SECURITY DEFINER functions, and there is no INSERT,
-- UPDATE or DELETE policy for a member to write through. That is a departure
-- from the column-grant rule in CLAUDE.md, and it is deliberate: the caps
-- (five live links per sesh, ten uses, an expiry clamped to the sesh start)
-- and the atomic spend are counting rules, and a counting rule cannot be a
-- column privilege. What that rule protects against — a member talking their
-- way past a check — is answered here by there being no write path at all.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  sesh_id uuid not null references public.seshes (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- sha256 of the token, hex. Unique so a mint collision is a database error
  -- rather than two live links that spend each other's uses.
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invites_max_uses_range check (max_uses between 1 and 10),
  -- The spend is guarded in redeem_invite() as well. This is the backstop
  -- that holds if a later plan ever adds a second way to spend one.
  constraint invites_use_count_range check (use_count >= 0 and use_count <= max_uses),
  -- Only ever a sha256 in hex. A token accidentally passed in place of a hash
  -- is refused by the database rather than quietly stored.
  constraint invites_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.invites is
  'A link a host hands out. Stores sha256(token), never the token. Uses are spent by redeem_invite() only.';

-- Lets invite_claims carry sesh_id under a composite foreign key. See the
-- note on that column.
alter table public.invites add constraint invites_id_sesh_key unique (id, sesh_id);

create table public.invite_claims (
  invite_id uuid not null,
  member_id uuid not null references public.profiles (id) on delete cascade,
  -- Denormalised so the visibility helper and the claims policy are
  -- single-table lookups rather than a join through `invites`, which has its
  -- own policy. It CANNOT drift: the composite foreign key below makes a
  -- claim whose sesh disagrees with its invite unwritable, by the database,
  -- not by convention.
  sesh_id uuid not null references public.seshes (id) on delete cascade,
  claimed_at timestamptz not null default now(),

  -- One row per person per link, which makes a repeat press idempotent for
  -- free: there is nothing to spend a second time.
  primary key (invite_id, member_id),
  foreign key (invite_id, sesh_id)
    references public.invites (id, sesh_id) on delete cascade
);

comment on table public.invite_claims is
  'Somebody walked through the door. Never an RSVP, never an input to can_see_address(). A claim is permanent; only denied or kicked ends its visibility.';

-- ---------------------------------------------------------------------------
-- Privileges
--
-- "Automatically expose new tables" is OFF, so nothing is granted by default.
-- service_role bypasses row POLICIES by attribute and never table PRIVILEGES,
-- which are checked first — so without these lines every server-side write
-- fails with 42501.
-- ---------------------------------------------------------------------------

grant all on public.invites to service_role;
grant all on public.invite_claims to service_role;

-- SELECT by column, and token_hash is not among them. A host's panel lists
-- their links, counts the claims and offers a revoke button, and at no point
-- can it read the one value that would let it rebuild the link. This is the
-- column-grant rule doing real work: column privileges are checked before RLS
-- and cannot be talked around.
grant select (id, sesh_id, created_by, expires_at, max_uses, use_count, revoked_at, created_at, updated_at)
  on public.invites to authenticated;

grant select on public.invite_claims to authenticated;

-- No INSERT, UPDATE or DELETE for `authenticated` on either table, on
-- purpose. See the header.

-- ---------------------------------------------------------------------------
-- Indexes — every foreign key, and every column a policy reads.
-- ---------------------------------------------------------------------------

create index invites_sesh_id_idx on public.invites (sesh_id);
create index invites_created_by_idx on public.invites (created_by);
-- The shape mint_invite counts in: the live links on one sesh.
create index invites_sesh_live_idx on public.invites (sesh_id, expires_at)
  where revoked_at is null;

-- The primary key already leads with invite_id. These two are the other two
-- directions: the visibility helper asks "does this member hold a claim on
-- this sesh", and the host's panel asks "who claimed on this sesh".
create index invite_claims_member_sesh_idx on public.invite_claims (member_id, sesh_id);
create index invite_claims_sesh_id_idx on public.invite_claims (sesh_id);

-- ---------------------------------------------------------------------------
-- Policy helpers — schema `private`, which the Data API does not expose.
-- ---------------------------------------------------------------------------

-- The invite-claim branch of the sesh read policy, and the reason it is
-- SECURITY DEFINER: a policy on `seshes` reading `invite_claims` would run
-- the claims policy, which reads `seshes`.
--
-- A denied or kicked RSVP ends a claim's visibility. That is the one thing
-- that does — revoking the link does not, and re-listing the sesh does not.
-- A link is not a way around a host's decision, and a host already has a tool
-- for removing somebody; a second, quieter one would remove people by
-- accident before notifications ship in Plan 05.
create or replace function private.has_invite_claim(p_sesh uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_claims c
    where c.sesh_id = p_sesh
      and c.member_id = p_user
  )
  and not exists (
    select 1 from public.rsvps r
    where r.sesh_id = p_sesh
      and r.member_id = p_user
      and r.status in ('denied', 'kicked')
  );
$$;

revoke execute on function private.has_invite_claim(uuid, uuid) from public, anon;
grant execute on function private.has_invite_claim(uuid, uuid) to authenticated, service_role;

comment on function private.has_invite_claim(uuid, uuid) is
  'Holding a claim the host has not overruled. Never an input to can_see_address().';

-- Is this link usable right now, ignoring who is asking. Read by the preview,
-- by the mint cap and by the spend, so the three cannot drift apart.
create or replace function private.invite_is_live(p_invite public.invites)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_invite.revoked_at is null
     and p_invite.expires_at > now()
     and p_invite.use_count < p_invite.max_uses;
$$;

revoke execute on function private.invite_is_live(public.invites) from public, anon;
grant execute on function private.invite_is_live(public.invites) to authenticated, service_role;

-- Is the sesh still somewhere a link can lead. The HOST's card is what is
-- checked, not the caller's: a host whose card lapses kills every link they
-- minted, and renewing brings them back.
create or replace function private.sesh_takes_invites(p_sesh public.seshes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sesh.id is not null
     and p_sesh.status = 'open'
     and p_sesh.starts_at > now()
     and private.is_active_member(p_sesh.host_id);
$$;

revoke execute on function private.sesh_takes_invites(public.seshes) from public, anon;
grant execute on function private.sesh_takes_invites(public.seshes) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. Enabled, never forced.
-- ---------------------------------------------------------------------------

alter table public.invites enable row level security;
alter table public.invite_claims enable row level security;

-- READ: the host of the sesh, and nobody else. Not the claimant — a
-- recipient has no business reading how many uses are left or when the link
-- dies — and NOT the app's own admin, which matches contributions.
--
-- can_browse rather than is_active_member, so a host whose card lapses can
-- still see and revoke what they already handed out (spec §4.3).
create policy invites_select on public.invites
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and private.is_host(sesh_id, (select auth.uid()))
  );

-- READ: the host of the sesh sees every claim on it; a member sees their own.
-- The host's branch is what the invite panel lists. It carries NO
-- verification status, here or in the grants — the panel renders "claimed,
-- not yet able to join" from the absence of an approved RSVP, which is one
-- derived state with three possible causes and discloses none of them.
create policy invite_claims_select on public.invite_claims
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      member_id = (select auth.uid())
      or private.is_host(sesh_id, (select auth.uid()))
    )
  );

-- No write policies. Minting, revoking and redeeming are the three functions
-- below, and `authenticated` holds no write privilege on either table, so
-- there is nothing for a policy to permit.

-- ---------------------------------------------------------------------------
-- The read rule gains its third branch
--
-- ADDITIVE: it widens "can you see this exists" and never narrows it, so
-- Plan 03's sesh-visibility tests and #28's unlisted tests stay green as the
-- regression net. private.can_browse still wraps the whole thing, which is
-- what makes a claim grant an unverified person NOTHING until their card is
-- reviewed — the row waits for them, the read does not arrive early.
-- ---------------------------------------------------------------------------

drop policy seshes_select on public.seshes;

create policy seshes_select on public.seshes
  for select to authenticated
  using (
    private.can_browse((select auth.uid()))
    and (
      -- A host always sees their own.
      host_id = (select auth.uid())
      -- Anybody holding a seat keeps seeing it, cancelled or not, listed or
      -- not, and whether or not the host's card has lapsed.
      or private.has_rsvp(id, (select auth.uid()))
      -- Anybody who walked through a link, until the host denies or kicks
      -- them. Revoking the link does not evict them, and re-listing the sesh
      -- does not admit anybody new.
      or private.has_invite_claim(id, (select auth.uid()))
      -- The public feed. This is the only branch an unlisted sesh fails, and
      -- it is the only branch that puts a sesh in front of a stranger.
      or (
        visibility = 'listed'
        and status = 'open'
        and private.is_active_member(host_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Minting
--
-- SECURITY DEFINER so the cap counts every live link on the sesh rather than
-- the caller's view of them. A cap that can be hidden from is not a cap.
--
-- The host supplies the HASH. The token itself is minted in TypeScript and
-- never crosses this boundary.
-- ---------------------------------------------------------------------------

create or replace function public.mint_invite(
  p_sesh uuid,
  p_token_hash text,
  p_max_uses integer,
  p_expires_at timestamptz
)
returns table (invite_id uuid, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_sesh public.seshes;
  v_live integer;
  v_expires timestamptz;
  v_id uuid;
begin
  if not private.is_active_member(v_caller) then
    raise exception 'card is not current' using errcode = 'M4W10';
  end if;

  select * into v_sesh from public.seshes s where s.id = p_sesh;

  -- Somebody else's sesh, a cancelled one, one that has started, and one
  -- whose host has lapsed all read the same way: you cannot make a link for
  -- this. Telling a stranger WHICH would turn this into a way to test whether
  -- an id exists.
  if v_sesh.host_id is distinct from v_caller
     or not private.sesh_takes_invites(v_sesh) then
    raise exception 'cannot make a link for that sesh' using errcode = 'M4W20';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 10 then
    raise exception 'uses must be between 1 and 10' using errcode = 'M4W22';
  end if;

  -- An expiry later than the sesh start is CLAMPED, not refused. A link that
  -- outlives the thing it leads to is a link to nothing.
  v_expires := least(coalesce(p_expires_at, v_sesh.starts_at), v_sesh.starts_at);

  if v_expires <= now() then
    raise exception 'that expiry has already passed' using errcode = 'M4W22';
  end if;

  select count(*) into v_live
    from public.invites i
   where i.sesh_id = p_sesh
     and private.invite_is_live(i);

  if v_live >= 5 then
    raise exception 'five live links is the most for one sesh' using errcode = 'M4W21';
  end if;

  insert into public.invites (sesh_id, created_by, token_hash, expires_at, max_uses)
  values (p_sesh, v_caller, p_token_hash, v_expires, p_max_uses)
  returning id into v_id;

  return query
    select i.id, i.expires_at, i.max_uses from public.invites i where i.id = v_id;
end;
$$;

revoke execute on function public.mint_invite(uuid, text, integer, timestamptz) from public, anon;
grant execute on function public.mint_invite(uuid, text, integer, timestamptz) to authenticated;

comment on function public.mint_invite(uuid, text, integer, timestamptz) is
  'Takes sha256(token), never the token. Clamps the expiry to the sesh start and caps a sesh at five live links.';

-- ---------------------------------------------------------------------------
-- Revoking
--
-- Changes only what happens NEXT. Everybody who already claimed stays
-- claimed, and stays able to read the sesh — see private.has_invite_claim.
-- ---------------------------------------------------------------------------

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_sesh uuid;
begin
  select i.sesh_id into v_sesh from public.invites i where i.id = p_invite;

  if v_sesh is null or not private.is_host(v_sesh, v_caller) then
    raise exception 'cannot revoke that link' using errcode = 'M4W20';
  end if;

  -- Idempotent, and revoked_at keeps the FIRST moment: a second press must
  -- not move the timestamp on a link that is already dead.
  update public.invites i
     set revoked_at = now()
   where i.id = p_invite
     and i.revoked_at is null;
end;
$$;

revoke execute on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The preview — a GET that spends NOTHING
--
-- Returns the sesh TITLE and START TIME and nothing else. Not the area name,
-- not the fuzzy circle, not the host's handle, not the sesh id. Just enough
-- for a human to know what they are being let into before they press.
--
-- Zero rows for a link that is expired, used up, revoked or never existed —
-- one answer, so the caller has nothing to enumerate with. A bad signature
-- never reaches here at all: lib/sesh/invite-token.ts throws it out without a
-- query, which is the whole point of the tag.
--
-- It does not look at who is asking. It cannot: the preview is what a person
-- sees BEFORE they commit to anything, and checking the caller here would
-- tell a denied member which of their two problems they have.
-- ---------------------------------------------------------------------------

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
     and private.sesh_takes_invites(s);
$$;

revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;

comment on function public.invite_preview(text) is
  'Title and start time only, and spends nothing. A GET must never burn a use — a chat app would eat the link drawing a preview card.';

-- ---------------------------------------------------------------------------
-- Redemption — ONE atomic operation
--
-- The invite row is taken FOR UPDATE before anything is counted, so two
-- simultaneous presses on a one-use link produce exactly one winner: the
-- second waits, re-reads use_count as 1, and is refused.
--
-- Every refusal raises the SAME code. Expired, used up, revoked, never
-- existed, wrong caller — one sentence on screen, no enumeration signal.
--
-- A CLAIM IS RECORDED EVEN WHEN THE CLAIMER IS NOT YET VERIFIED. That is what
-- lets a link wait for somebody across a multi-day card review: the memory is
-- a server-side row, not a cookie. private.can_browse still refuses them the
-- sesh until they are verified, so the claim grants nothing early. A use
-- spent by somebody who never finishes verification STAYS spent — nothing
-- about a link's liveness may depend on a future event, because that is the
-- race the row lock exists to kill.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_invite public.invites;
  v_sesh public.seshes;
  v_status public.member_status;
  v_claimed boolean;
begin
  if v_caller is null then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  select p.status into v_status from public.profiles p where p.id = v_caller;

  -- Suspended means suspended. Note this is NOT is_active_member: an
  -- unverified or pending member IS allowed through, and that is the point.
  if v_status is null or v_status = 'suspended' then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  -- The lock, before anything is counted or decided.
  select * into v_invite from public.invites i where i.token_hash = p_token_hash for update;

  if v_invite.id is null then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  select * into v_sesh from public.seshes s where s.id = v_invite.sesh_id;

  -- A cancelled sesh, a started sesh, and a host whose card has lapsed each
  -- kill every link for that sesh.
  if not private.sesh_takes_invites(v_sesh) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  -- A host is not their own guest.
  if v_sesh.host_id = v_caller then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  -- A link is not a way around a host's decision.
  if exists (
    select 1 from public.rsvps r
    where r.sesh_id = v_sesh.id
      and r.member_id = v_caller
      and r.status in ('denied', 'kicked')
  ) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  -- A SECOND PRESS BY THE SAME MEMBER BURNS NO SECOND USE, and is checked
  -- BEFORE liveness on purpose. Somebody who already walked through the door
  -- pressing again is not a new press: they are already inside, and the
  -- honest answer is to put them back where they were. On a one-use link the
  -- use is already spent by their own first press, so checking liveness first
  -- would refuse the one person with the best claim to the link.
  select true into v_claimed
    from public.invite_claims c
   where c.invite_id = v_invite.id
     and c.member_id = v_caller;

  if v_claimed then
    return v_invite.sesh_id;
  end if;

  if not private.invite_is_live(v_invite) then
    raise exception 'that link does not work' using errcode = 'M4W19';
  end if;

  insert into public.invite_claims (invite_id, member_id, sesh_id)
  values (v_invite.id, v_caller, v_invite.sesh_id);

  update public.invites i
     set use_count = i.use_count + 1,
         updated_at = now()
   where i.id = v_invite.id;

  return v_invite.sesh_id;
end;
$$;

revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

comment on function public.redeem_invite(text) is
  'Spends one use under a row lock and writes a claim. Never writes an RSVP. Every refusal raises M4W19.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger invites_touch_updated_at
  before update on public.invites
  for each row execute function public.touch_updated_at();
