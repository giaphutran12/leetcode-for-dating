create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.rizzcode_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level text not null check (access_level = 'admin'),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.rizzcode_access_grants enable row level security;

revoke all on table private.rizzcode_access_grants
  from public, anon, authenticated, service_role;

insert into private.rizzcode_access_grants (
  user_id,
  access_level,
  reason
) values (
  '314ca5a0-b1bc-4b21-8641-4a8031066a06',
  'admin',
  'RizzCode owner access'
)
on conflict (user_id) do update
set
  access_level = excluded.access_level,
  reason = excluded.reason,
  expires_at = null,
  updated_at = now();

create or replace function public.get_rizzcode_access_level(
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select access_level
      from private.rizzcode_access_grants
      where user_id = p_user_id
        and (expires_at is null or expires_at > now())
    ),
    'free'
  );
$$;

revoke all on function public.get_rizzcode_access_level(uuid)
  from public, anon, authenticated;
grant execute on function public.get_rizzcode_access_level(uuid)
  to service_role;

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
  scenario_used boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1
    from private.rizzcode_access_grants
    where user_id = p_user_id
      and access_level = 'admin'
      and (expires_at is null or expires_at > now())
  ) then
    return query select true, false, null::integer, 'admin'::text;
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

  select
    count(distinct used.scenario_id)::integer,
    coalesce(bool_or(used.scenario_id = p_scenario_id), false)
  into used_count, scenario_used
  from (
    select jsonb_array_elements_text(
      coalesce(state #> '{progress,completedScenarioIds}', '[]'::jsonb)
    ) as scenario_id
    from public.rizzcode_user_state
    where user_id = p_user_id

    union

    select scenario_id
    from public.rizzcode_practice_usage
    where user_id = p_user_id
  ) as used;

  if exists (
    select 1
    from public.rizzcode_practice_usage
    where user_id = p_user_id and attempt_id = p_attempt_id
  ) or scenario_used then
    return query select
      true,
      false,
      greatest(0, 3 - used_count),
      'existing_attempt'::text;
    return;
  end if;

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

comment on table private.rizzcode_access_grants is
  'Server-owned grants for non-Stripe RizzCode access.';
