-- HotelIndice: price alerts. Each person watches stays and is emailed when the price reaches their target.
-- People can only see and change their own alerts. The daily checker uses the service key, which skips these rules.

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hotel_id text not null check (char_length(hotel_id) <= 160),
  hotel_name text not null check (char_length(hotel_name) <= 160),
  city text not null default '' check (char_length(city) <= 100),
  check_in date not null,
  check_out date not null,
  adults integer not null default 2 check (adults between 1 and 10),
  children integer not null default 0 check (children between 0 and 6),
  target_price numeric(10, 2) not null check (target_price > 0 and target_price < 100000),
  start_price numeric(10, 2),
  last_price numeric(10, 2),
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  last_notified_price numeric(10, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint price_alerts_dates check (check_out > check_in),
  constraint price_alerts_unique unique (user_id, hotel_id, check_in, check_out)
);

create index if not exists price_alerts_active_idx on public.price_alerts (active, check_out);

alter table public.price_alerts enable row level security;

revoke all on public.price_alerts from anon;
grant select, insert, update, delete on public.price_alerts to authenticated;

drop policy if exists "Read own alerts" on public.price_alerts;
create policy "Read own alerts" on public.price_alerts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Add own alerts" on public.price_alerts;
create policy "Add own alerts" on public.price_alerts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Change own alerts" on public.price_alerts;
create policy "Change own alerts" on public.price_alerts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own alerts" on public.price_alerts;
create policy "Delete own alerts" on public.price_alerts
  for delete to authenticated using (user_id = (select auth.uid()));
