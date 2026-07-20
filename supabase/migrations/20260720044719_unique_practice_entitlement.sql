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
