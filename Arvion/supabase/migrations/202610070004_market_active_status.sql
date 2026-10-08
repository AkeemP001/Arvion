-- Align Market visibility policies with the existing uppercase listing status constraint.
-- Seller ownership checks and storage scope restrictions are unchanged.

drop policy if exists "Market users read active listings and own listings" on public.market_listings;
create policy "Market users read active listings and own listings"
on public.market_listings
for select
to authenticated
using (status = 'ACTIVE' or seller_id = (select auth.uid()));

drop policy if exists "Market users read active or own listing images" on public.market_listing_images;
create policy "Market users read active or own listing images"
on public.market_listing_images
for select
to authenticated
using (
  exists (
    select 1
    from public.market_listings listing
    where listing.id = market_listing_images.listing_id
      and (listing.status = 'ACTIVE' or listing.seller_id = (select auth.uid()))
      and market_listing_images.storage_path like listing.id::text || '/%'
  )
);

drop policy if exists "Market listing images are readable" on storage.objects;
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
      and (listing.status = 'ACTIVE' or listing.seller_id = (select auth.uid()))
  )
);

drop policy if exists "Market listing image read scope" on storage.objects;
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
      and (listing.status = 'ACTIVE' or listing.seller_id = (select auth.uid()))
  )
);
