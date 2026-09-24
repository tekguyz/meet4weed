-- Meet4Weed — the Claude spend ledger (issue #71)
--
-- Claude's cost sat only on public.verifications, and those rows cascade away
-- with the member. Once a member can delete their account, that would shrink
-- the month's spend on the admin page, and the $5 limit would be read against
-- a number that is too low.
--
-- So every paid call also lands in public.vision_spend, which names no member
-- and no submission. Nothing points at it, so no delete can reach it. The admin
-- spend figures read it instead.
--
-- verifications.cost_usd stays: the admin's submission page shows what that one
-- call cost, and while the member exists it is the same number.

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

create table public.vision_spend (
  id bigint generated always as identity primary key,
  -- The submission's own time, not the moment the row was written, so the
  -- backfill and a live call count towards the same Florida day.
  spent_at timestamptz not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 6)
);

comment on table public.vision_spend is
  'One row per Claude call. No member link, on purpose: spend must survive a deleted account. Written by a trigger on verifications.';

-- verification_spend() reads one month at a time.
create index vision_spend_spent_at_idx on public.vision_spend (spent_at);

alter table public.vision_spend enable row level security;

-- No policies and no grants for members. The admin reads it through
-- verification_spend(), which runs as its owner.
grant all on public.vision_spend to service_role;

-- ---------------------------------------------------------------------------
-- The trigger — every call is recorded in the same statement that records it
-- on the submission, so the two can never disagree.
--
-- A call is "made" when `model` is first set. recordVision() writes it once
-- per submission; the old-is-null check stops a second write counting twice.
-- ---------------------------------------------------------------------------

create or replace function public.record_vision_spend()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.model is not null and (tg_op = 'INSERT' or old.model is null) then
    insert into public.vision_spend (spent_at, model, input_tokens, output_tokens, cost_usd)
    values (new.created_at, new.model, new.input_tokens, new.output_tokens, new.cost_usd);
  end if;
  return new;
end;
$$;

revoke execute on function public.record_vision_spend() from public, anon, authenticated;

create trigger verifications_record_vision_spend
  after insert or update of model on public.verifications
  for each row
  execute function public.record_vision_spend();

-- ---------------------------------------------------------------------------
-- Backfill — every call already made. Same filter the old figures used.
-- ---------------------------------------------------------------------------

insert into public.vision_spend (spent_at, model, input_tokens, output_tokens, cost_usd)
select v.created_at, v.model, v.input_tokens, v.output_tokens, v.cost_usd
from public.verifications v
where v.model is not null;

-- ---------------------------------------------------------------------------
-- The admin figures read the ledger. Same signature, same rules.
-- ---------------------------------------------------------------------------

create or replace function public.verification_spend()
returns table (today_usd numeric, month_usd numeric, today_calls integer, month_calls integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.florida_today();
begin
  if not private.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  return query
    select
      coalesce(sum(s.cost_usd) filter (where (s.spent_at at time zone 'America/New_York')::date = v_today), 0),
      coalesce(sum(s.cost_usd), 0),
      (count(*) filter (where (s.spent_at at time zone 'America/New_York')::date = v_today))::integer,
      count(*)::integer
    from public.vision_spend s
    where s.spent_at >= (date_trunc('month', v_today::timestamp) at time zone 'America/New_York');
end;
$$;

revoke execute on function public.verification_spend() from public, anon;
grant execute on function public.verification_spend() to authenticated;
