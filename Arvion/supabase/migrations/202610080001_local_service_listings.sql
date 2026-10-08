-- Local provider offerings are separate from customer-created local_jobs.
-- Existing LOCAL_JOB categories are reused; Market tables and policies are untouched.

insert into public.categories (domain, name, slug, active, sort_order)
values
  ('LOCAL_JOB', 'Home Services', 'home-services', true, 5),
  ('LOCAL_JOB', 'Repairs & Maintenance', 'repairs-maintenance', true, 45),
  ('LOCAL_JOB', 'Automotive', 'automotive', true, 55),
  ('LOCAL_JOB', 'Beauty & Personal Care', 'beauty-personal-care', true, 65),
  ('LOCAL_JOB', 'Education & Tutoring', 'education-tutoring', true, 75),
  ('LOCAL_JOB', 'Photography & Media', 'photography-media', true, 80),
  ('LOCAL_JOB', 'Technology & Digital Services', 'technology-digital-services', true, 85),
  ('LOCAL_JOB', 'Events', 'events', true, 95)
on conflict (domain, slug) do nothing;

create table if not exists public.local_service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  price_minor bigint not null check (price_minor > 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  location_area text not null check (char_length(btrim(location_area)) between 1 and 120),
  location_city text,
  location_state text,
  location_country text not null default 'Nigeria' check (char_length(btrim(location_country)) between 1 and 120),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'REMOVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists local_service_listings_discovery_idx
  on public.local_service_listings (status, created_at desc);
create index if not exists local_service_listings_category_idx
  on public.local_service_listings (category_id, status, created_at desc);
create index if not exists local_service_listings_provider_idx
  on public.local_service_listings (provider_id, created_at desc);

create table if not exists public.local_service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.local_service_listings(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists local_service_images_service_idx
  on public.local_service_images (service_id, sort_order);

create or replace function public.set_local_service_listing_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_local_service_listing_updated_at() from public, anon, authenticated;

drop trigger if exists local_service_listings_updated_at on public.local_service_listings;
create trigger local_service_listings_updated_at
before update on public.local_service_listings
for each row execute function public.set_local_service_listing_updated_at();

alter table public.local_service_listings enable row level security;
alter table public.local_service_images enable row level security;

grant select on public.local_service_listings, public.local_service_images to anon, authenticated;
grant insert, update, delete on public.local_service_listings, public.local_service_images to authenticated;

drop policy if exists "Local active services are discoverable" on public.local_service_listings;
create policy "Local active services are discoverable"
on public.local_service_listings
for select
to anon, authenticated
using (status = 'ACTIVE');

drop policy if exists "Providers read their own services" on public.local_service_listings;
create policy "Providers read their own services"
on public.local_service_listings
for select
to authenticated
using (provider_id = (select auth.uid()));

drop policy if exists "Providers create their own services" on public.local_service_listings;
create policy "Providers create their own services"
on public.local_service_listings
for insert
to authenticated
with check (
  provider_id = (select auth.uid())
  and exists (
    select 1 from public.categories category
    where category.id = local_service_listings.category_id
      and category.domain = 'LOCAL_JOB'
      and category.active
  )
);

drop policy if exists "Providers update their own services" on public.local_service_listings;
create policy "Providers update their own services"
on public.local_service_listings
for update
to authenticated
using (provider_id = (select auth.uid()))
with check (
  provider_id = (select auth.uid())
  and exists (
    select 1 from public.categories category
    where category.id = local_service_listings.category_id
      and category.domain = 'LOCAL_JOB'
  )
);

drop policy if exists "Providers delete their own services" on public.local_service_listings;
create policy "Providers delete their own services"
on public.local_service_listings
for delete
to authenticated
using (provider_id = (select auth.uid()));

drop policy if exists "Local active service images are discoverable" on public.local_service_images;
create policy "Local active service images are discoverable"
on public.local_service_images
for select
to anon, authenticated
using (
  exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.status = 'ACTIVE'
  )
);

drop policy if exists "Providers read their own service images" on public.local_service_images;
create policy "Providers read their own service images"
on public.local_service_images
for select
to authenticated
using (
  exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.provider_id = (select auth.uid())
  )
);

drop policy if exists "Providers add images to their own services" on public.local_service_images;
create policy "Providers add images to their own services"
on public.local_service_images
for insert
to authenticated
with check (
  storage_path like service_id::text || '/%'
  and exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.provider_id = (select auth.uid())
  )
);

drop policy if exists "Providers update their own service images" on public.local_service_images;
create policy "Providers update their own service images"
on public.local_service_images
for update
to authenticated
using (
  exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.provider_id = (select auth.uid())
  )
)
with check (
  storage_path like service_id::text || '/%'
  and exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.provider_id = (select auth.uid())
  )
);

drop policy if exists "Providers delete their own service images" on public.local_service_images;
create policy "Providers delete their own service images"
on public.local_service_images
for delete
to authenticated
using (
  exists (
    select 1 from public.local_service_listings service
    where service.id = local_service_images.service_id
      and service.provider_id = (select auth.uid())
  )
);

create or replace function public.get_local_service_provider_identities(p_service_ids uuid[])
returns table (service_id uuid, display_name text, username text, arvion_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select service.id,
         coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Arvion provider'),
         profile.username,
         profile.arvion_id
  from unnest(p_service_ids) requested(service_id)
  join public.local_service_listings service on service.id = requested.service_id
  left join public.profiles profile on profile.auth_user_id = service.provider_id
  where service.status = 'ACTIVE'
     or service.provider_id = (select auth.uid());
$$;

revoke all on function public.get_local_service_provider_identities(uuid[]) from public;
grant execute on function public.get_local_service_provider_identities(uuid[]) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'local-service-images',
  'local-service-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Local service images are readable" on storage.objects;
create policy "Local service images are readable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'local-service-images'
  and exists (
    select 1 from public.local_service_listings service
    where service.id::text = (storage.foldername(name))[1]
      and (service.status = 'ACTIVE' or service.provider_id = (select auth.uid()))
  )
);

drop policy if exists "Providers upload images to their own services" on storage.objects;
create policy "Providers upload images to their own services"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'local-service-images'
  and exists (
    select 1 from public.local_service_listings service
    where service.id::text = (storage.foldername(name))[1]
      and service.provider_id = (select auth.uid())
  )
);

drop policy if exists "Providers update images of their own services" on storage.objects;
create policy "Providers update images of their own services"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'local-service-images'
  and exists (
    select 1 from public.local_service_listings service
    where service.id::text = (storage.foldername(name))[1]
      and service.provider_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'local-service-images'
  and exists (
    select 1 from public.local_service_listings service
    where service.id::text = (storage.foldername(name))[1]
      and service.provider_id = (select auth.uid())
  )
);

drop policy if exists "Providers delete images of their own services" on storage.objects;
create policy "Providers delete images of their own services"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'local-service-images'
  and exists (
    select 1 from public.local_service_listings service
    where service.id::text = (storage.foldername(name))[1]
      and service.provider_id = (select auth.uid())
  )
);
