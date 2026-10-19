-- Development-only search fixtures.
-- Do not run this script against production: it disables RLS on both tables.

create extension if not exists "pgcrypto";

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  title text,
  price text
);

create table if not exists public.local_services (
  id uuid primary key default gen_random_uuid(),
  title text,
  location text
);

alter table public.market_listings disable row level security;
alter table public.local_services disable row level security;

grant select on public.market_listings, public.local_services to anon, authenticated;

insert into public.market_listings (id, title, price)
values
  ('f37d6c44-6117-4b4e-9cb7-887179790001', 'iPhone 13', '₦450,000'),
  ('f37d6c44-6117-4b4e-9cb7-887179790002', 'Wireless Headphones', '₦35,000')
on conflict (id) do update
set title = excluded.title,
    price = excluded.price;

insert into public.local_services (id, title, location)
values
  ('ab9448d7-4232-4135-88ce-dafae11a0001', 'Plumber', 'Ikeja, Lagos'),
  ('ab9448d7-4232-4135-88ce-dafae11a0002', 'Electrician', 'Lekki, Lagos')
on conflict (id) do update
set title = excluded.title,
    location = excluded.location;
