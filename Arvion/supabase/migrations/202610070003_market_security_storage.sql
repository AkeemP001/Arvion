-- Market listing ownership, image metadata, and private listing-image storage.
-- Existing Market tables and auth/profile configuration are intentionally reused.

alter table public.market_listings enable row level security;
alter table public.market_listing_images enable row level security;
grant select, insert, update, delete on public.market_listings, public.market_listing_images to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('market_listings', 'market_listing_images')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

create policy "Market users read active listings and own listings"
on public.market_listings
for select
to authenticated
using (status = 'active' or seller_id = (select auth.uid()));

create policy "Market sellers create own listings"
on public.market_listings
for insert
to authenticated
with check (seller_id = (select auth.uid()));

create policy "Market sellers update own listings"
on public.market_listings
for update
to authenticated
using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));

create policy "Market sellers delete own listings"
on public.market_listings
for delete
to authenticated
using (seller_id = (select auth.uid()));

create policy "Market users read active or own listing images"
on public.market_listing_images
for select
to authenticated
using (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and (listing.status = 'active' or listing.seller_id = (select auth.uid()))
      and market_listing_images.storage_path like listing.id::text || '/%'
  )
);

create policy "Market sellers add own listing images"
on public.market_listing_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and listing.seller_id = (select auth.uid())
      and market_listing_images.storage_path like listing.id::text || '/%'
  )
);

create policy "Market sellers update own listing images"
on public.market_listing_images
for update
to authenticated
using (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and listing.seller_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and listing.seller_id = (select auth.uid())
      and market_listing_images.storage_path like listing.id::text || '/%'
  )
);

create policy "Market sellers delete own listing images"
on public.market_listing_images
for delete
to authenticated
using (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and listing.seller_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market-listing-images',
  'market-listing-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Market listing images are readable" on storage.objects;
drop policy if exists "Market sellers upload listing images" on storage.objects;
drop policy if exists "Market sellers update listing images" on storage.objects;
drop policy if exists "Market sellers delete listing images" on storage.objects;
drop policy if exists "Market listing image read scope" on storage.objects;
drop policy if exists "Market listing image insert scope" on storage.objects;
drop policy if exists "Market listing image update scope" on storage.objects;
drop policy if exists "Market listing image delete scope" on storage.objects;

create policy "Market listing images are readable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'market-listing-images'
  and exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and (
        listing.status = 'active'
        or listing.seller_id = (select auth.uid())
      )
  )
);

create policy "Market sellers upload listing images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'market-listing-images'
  and exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);

create policy "Market sellers update listing images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'market-listing-images'
  and exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'market-listing-images'
  and exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);

create policy "Market sellers delete listing images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'market-listing-images'
  and exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);

create policy "Market listing image read scope"
on storage.objects
as restrictive
for select
to anon, authenticated
using (
  bucket_id <> 'market-listing-images'
  or exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and (
        listing.status = 'active'
        or listing.seller_id = (select auth.uid())
      )
  )
);

create policy "Market listing image insert scope"
on storage.objects
as restrictive
for insert
to public
with check (
  bucket_id <> 'market-listing-images'
  or exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);

create policy "Market listing image update scope"
on storage.objects
as restrictive
for update
to public
using (
  bucket_id <> 'market-listing-images'
  or exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
)
with check (
  bucket_id <> 'market-listing-images'
  or exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);

create policy "Market listing image delete scope"
on storage.objects
as restrictive
for delete
to public
using (
  bucket_id <> 'market-listing-images'
  or exists (
    select 1
    from public.market_listings listing
    where listing.id::text = (storage.foldername(name))[1]
      and listing.seller_id = (select auth.uid())
  )
);
