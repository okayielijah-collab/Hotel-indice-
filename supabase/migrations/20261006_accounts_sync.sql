-- HotelIndice: one row per signed in person, holding their saved trips and saved stays.
-- Each person can only read and write their own row.

create table if not exists public.user_stores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 600000),
  updated_at timestamptz not null default now()
);

alter table public.user_stores enable row level security;

revoke all on public.user_stores from anon;
grant select, insert, update, delete on public.user_stores to authenticated;

drop policy if exists "Read own store" on public.user_stores;
create policy "Read own store" on public.user_stores
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Add own store" on public.user_stores;
create policy "Add own store" on public.user_stores
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Change own store" on public.user_stores;
create policy "Change own store" on public.user_stores
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own store" on public.user_stores;
create policy "Delete own store" on public.user_stores
  for delete to authenticated using (user_id = (select auth.uid()));
