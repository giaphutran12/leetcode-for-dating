create table public.rizzcode_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null default 1 check (state_version = 1),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.rizzcode_user_state enable row level security;

revoke all on table public.rizzcode_user_state from anon;
grant select, insert, update, delete
  on table public.rizzcode_user_state
  to authenticated;

create policy "Users can read their own RizzCode state"
  on public.rizzcode_user_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own RizzCode state"
  on public.rizzcode_user_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own RizzCode state"
  on public.rizzcode_user_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own RizzCode state"
  on public.rizzcode_user_state
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
