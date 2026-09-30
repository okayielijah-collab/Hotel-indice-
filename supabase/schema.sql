-- Run this once in the Supabase SQL editor. The browser never writes to this table.
create extension if not exists pgcrypto;

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  country text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  price_tier text not null check (price_tier in ('Budget', 'Mid-range', 'Luxury')),
  estimated_price_per_night numeric(10, 2) not null check (estimated_price_per_night >= 0),
  amenities text[] not null default '{}',
  vibe_tags text[] not null default '{}',
  editorial_notes text not null default '',
  image_urls text[] not null default '{}',
  affiliate_booking_link text not null default '',
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0)
);

create index if not exists hotels_location_idx on public.hotels (city, country);
create index if not exists hotels_amenities_idx on public.hotels using gin (amenities);
create index if not exists hotels_vibes_idx on public.hotels using gin (vibe_tags);

alter table public.hotels enable row level security;
drop policy if exists "Anyone can read hotel listings" on public.hotels;
create policy "Anyone can read hotel listings" on public.hotels for select to anon, authenticated using (true);
grant select on public.hotels to anon, authenticated;
