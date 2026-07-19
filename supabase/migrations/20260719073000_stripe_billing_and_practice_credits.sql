create table public.rizzcode_billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rizzcode_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rizzcode_practice_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id text not null,
  scenario_id text not null,
  consumed_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

create index rizzcode_practice_usage_user_consumed_idx
  on public.rizzcode_practice_usage (user_id, consumed_at);

alter table public.rizzcode_billing_customers enable row level security;
alter table public.rizzcode_subscriptions enable row level security;
alter table public.rizzcode_practice_usage enable row level security;

revoke all on table public.rizzcode_billing_customers from anon, authenticated;
revoke all on table public.rizzcode_subscriptions from anon, authenticated;
revoke all on table public.rizzcode_practice_usage from anon, authenticated;

create or replace function public.claim_rizzcode_practice(
  p_user_id uuid,
  p_attempt_id text,
  p_scenario_id text
)
returns table (
  allowed boolean,
  paid boolean,
  remaining_credits integer,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1
    from public.rizzcode_practice_usage
    where user_id = p_user_id and attempt_id = p_attempt_id
  ) then
    select count(*)::integer
      into used_count
      from public.rizzcode_practice_usage
      where user_id = p_user_id;
    return query select
      true,
      false,
      greatest(0, 3 - used_count),
      'existing_attempt'::text;
    return;
  end if;

  if exists (
    select 1
    from public.rizzcode_subscriptions
    where user_id = p_user_id
      and status in ('active', 'trialing')
  ) then
    return query select true, true, null::integer, 'paid'::text;
    return;
  end if;

  select count(*)::integer
    into used_count
    from public.rizzcode_practice_usage
    where user_id = p_user_id;

  if used_count >= 3 then
    return query select false, false, 0, 'limit_reached'::text;
    return;
  end if;

  insert into public.rizzcode_practice_usage (
    user_id,
    attempt_id,
    scenario_id
  ) values (
    p_user_id,
    p_attempt_id,
    p_scenario_id
  );

  return query select
    true,
    false,
    greatest(0, 2 - used_count),
    'free_credit'::text;
end;
$$;

revoke all on function public.claim_rizzcode_practice(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_rizzcode_practice(uuid, text, text)
  to service_role;
