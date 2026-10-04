-- HotelIndice: anonymous usage events (searches, "Check rates" opens and partner clicks).
-- Visitors can only INSERT. Nobody can read these rows through the public API;
-- read them in the Supabase dashboard (Table Editor or SQL Editor).

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('search', 'rates_open', 'partner_click')),
  query text check (query is null or char_length(query) <= 200),
  destination text check (destination is null or char_length(destination) <= 100),
  results integer check (results is null or results between 0 and 1000),
  hotel_id text check (hotel_id is null or char_length(hotel_id) <= 80),
  partner text check (partner is null or char_length(partner) <= 40),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_kind_created_idx on public.usage_events (kind, created_at desc);

alter table public.usage_events enable row level security;

revoke all on public.usage_events from anon, authenticated;
grant insert on public.usage_events to anon, authenticated;
grant usage, select on sequence public.usage_events_id_seq to anon, authenticated;

drop policy if exists "Anyone can add a usage event" on public.usage_events;
create policy "Anyone can add a usage event"
  on public.usage_events
  for insert
  to anon, authenticated
  with check (true);

-- Handy questions to run in the SQL Editor:
--
-- Searches that found nothing (what to source next):
--   select query, destination, count(*) from public.usage_events
--   where kind = 'search' and results = 0 group by 1, 2 order by 3 desc limit 50;
--
-- Which stays get "Check rates" clicks:
--   select hotel_id, partner, count(*) from public.usage_events
--   where kind = 'partner_click' group by 1, 2 order by 3 desc limit 50;
--
-- Searches per day:
--   select date_trunc('day', created_at) as day, count(*) from public.usage_events
--   where kind = 'search' group by 1 order by 1 desc;
