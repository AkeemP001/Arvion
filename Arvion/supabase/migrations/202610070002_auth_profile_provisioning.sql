alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists currency text default 'NGN';
alter table public.profiles add column if not exists language text default 'en';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists gender text check (gender in ('Male','Female'));
update public.profiles set display_name=full_name where (display_name is null or btrim(display_name)='') and full_name is not null;
insert into storage.buckets (id,name,public) values ('profile-avatars','profile-avatars', false) on conflict (id) do nothing;
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar" on storage.objects for insert to authenticated with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar" on storage.objects for update to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users can read own avatar" on storage.objects;
create policy "Users can read own avatar" on storage.objects for select to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar" on storage.objects for delete to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop trigger if exists create_profile_for_auth_user on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_profile_for_auth_user();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles (id,auth_user_id,full_name,email,arvion_id,display_name,username,phone,country,gender,avatar_url)
 values (new.id,new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,coalesce(new.raw_user_meta_data->>'arvion_id', lower(split_part(new.email,'@',1))),coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'username', lower(new.raw_user_meta_data->>'arvion_id')),nullif(btrim(coalesce(new.raw_user_meta_data->>'phone','')),''),nullif(btrim(coalesce(new.raw_user_meta_data->>'country','')),''),nullif(btrim(coalesce(new.raw_user_meta_data->>'gender','')),''),nullif(btrim(coalesce(new.raw_user_meta_data->>'avatar_url','')),'' ))
 on conflict (auth_user_id) do update set full_name=case when btrim(public.profiles.full_name)='' then excluded.full_name else public.profiles.full_name end, arvion_id=coalesce(public.profiles.arvion_id, excluded.arvion_id), display_name=coalesce(nullif(btrim(public.profiles.display_name),''), excluded.display_name), username=coalesce(public.profiles.username, excluded.username), phone=coalesce(public.profiles.phone, excluded.phone), country=coalesce(public.profiles.country, excluded.country), gender=coalesce(public.profiles.gender, excluded.gender), avatar_url=coalesce(public.profiles.avatar_url, excluded.avatar_url);
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;