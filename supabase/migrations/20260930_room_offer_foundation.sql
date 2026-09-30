-- HotelIndice: provider-neutral room + offer foundation.
-- Safe to apply after the existing public.hotels table exists.

create table if not exists public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  provider text not null,
  provider_room_id text not null,
  name text not null,
  room_size_sqm numeric(8, 2),
  max_occupancy integer,
  max_adults integer,
  max_children integer,
  bed_configuration jsonb not null default '[]'::jsonb,
  amenities text[] not null default '{}',
  raw_content jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_room_id),
  check (room_size_sqm is null or room_size_sqm > 0),
  check (max_occupancy is null or max_occupancy > 0),
  check (max_adults is null or max_adults > 0),
  check (max_children is null or max_children >= 0)
);

create index if not exists hotel_rooms_hotel_idx on public.hotel_rooms (hotel_id);
create index if not exists hotel_rooms_provider_idx on public.hotel_rooms (provider);
create index if not exists hotel_rooms_size_idx on public.hotel_rooms (room_size_sqm);

create table if not exists public.hotel_offers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.hotel_rooms(id) on delete cascade,
  provider text not null,
  provider_offer_id text not null,
  check_in date not null,
  check_out date not null,
  adults integer not null default 2,
  children integer not null default 0,
  currency text not null,
  total_price numeric(12, 2) not null,
  price_per_night numeric(12, 2),
  available boolean not null default true,
  cancellation_policy jsonb,
  meal_plan text,
  booking_url text,
  expires_at timestamptz,
  raw_offer jsonb,
  fetched_at timestamptz not null default now(),
  unique (provider, provider_offer_id, check_in, check_out, adults, children),
  check (check_out > check_in),
  check (adults > 0),
  check (children >= 0),
  check (total_price >= 0),
  check (price_per_night is null or price_per_night >= 0)
);

create index if not exists hotel_offers_room_idx on public.hotel_offers (room_id);
create index if not exists hotel_offers_dates_idx on public.hotel_offers (check_in, check_out);
create index if not exists hotel_offers_available_idx on public.hotel_offers (available, check_in, check_out);
create index if not exists hotel_offers_fetched_idx on public.hotel_offers (fetched_at desc);

alter table public.hotel_rooms enable row level security;
alter table public.hotel_offers enable row level security;

-- These are intentionally read-only from the browser. Provider ingestion should
-- happen server-side with a privileged connection, never from the client.
drop policy if exists "Anyone can read hotel rooms" on public.hotel_rooms;
create policy "Anyone can read hotel rooms" on public.hotel_rooms
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can read hotel offers" on public.hotel_offers;
create policy "Anyone can read hotel offers" on public.hotel_offers
  for select to anon, authenticated using (true);

grant select on public.hotel_rooms to anon, authenticated;
grant select on public.hotel_offers to anon, authenticated;
