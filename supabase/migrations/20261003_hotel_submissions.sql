-- HotelIndice: hotels submitted through the "List your hotel" form.
-- Visitors can only INSERT. Nobody can read these rows through the public API;
-- review them in the Supabase dashboard (Table Editor) instead.

create table if not exists public.hotel_submissions (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null check (char_length(hotel_name) between 2 and 120),
  city text not null check (char_length(city) between 2 and 80),
  country text not null check (char_length(country) between 2 and 80),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  contact_email text not null check (char_length(contact_email) between 5 and 120),
  role text not null default 'Owner' check (role in ('Owner', 'Manager', 'Agent', 'Other')),
  website text check (website is null or char_length(website) <= 300),
  price_from_usd numeric(10, 2) check (price_from_usd is null or price_from_usd > 0),
  amenities text[] not null default '{}',
  description text not null default '' check (char_length(description) <= 600),
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.hotel_submissions enable row level security;

revoke all on public.hotel_submissions from anon, authenticated;
grant insert on public.hotel_submissions to anon, authenticated;

drop policy if exists "Anyone can submit a hotel" on public.hotel_submissions;
create policy "Anyone can submit a hotel"
  on public.hotel_submissions
  for insert
  to anon, authenticated
  with check (status = 'new');
