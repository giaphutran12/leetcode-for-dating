create table public.rizzcode_conversation_events (
  id bigint generated always as identity primary key,
  attempt_id text not null,
  scenario_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'persona.turn.completed',
      'persona.provider.failed',
      'judge.started',
      'judge.completed',
      'judge.failed'
    )
  ),
  model text not null,
  turn smallint check (turn between 1 and 6),
  operation smallint check (operation between 1 and 2),
  used_fallback boolean,
  conversation jsonb not null,
  persona_state jsonb not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index rizzcode_conversation_events_attempt_created_idx
  on public.rizzcode_conversation_events (attempt_id, created_at);

create index rizzcode_conversation_events_user_created_idx
  on public.rizzcode_conversation_events (user_id, created_at desc)
  where user_id is not null;

alter table public.rizzcode_conversation_events enable row level security;

revoke all on table public.rizzcode_conversation_events
  from public, anon, authenticated;
revoke all on sequence public.rizzcode_conversation_events_id_seq
  from public, anon, authenticated;

grant insert, select on table public.rizzcode_conversation_events
  to service_role;
grant usage, select on sequence public.rizzcode_conversation_events_id_seq
  to service_role;

comment on table public.rizzcode_conversation_events is
  'Server-only append log for persona transcripts, model replies, and judge outcomes.';
