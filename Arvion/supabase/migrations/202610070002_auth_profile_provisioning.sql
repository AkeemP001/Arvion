create or replace function public.is_arvion_id_available(candidate_arvion_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    candidate_arvion_id ~ '^[A-Za-z0-9_]{3,20}$'
      and not exists (
        select 1
        from public.profiles
        where profiles.arvion_id = candidate_arvion_id
      ),
    false
  );
$$;

revoke all on function public.is_arvion_id_available(text) from public;
grant execute on function public.is_arvion_id_available(text) to anon, authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, full_name, email, arvion_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'arvion_id'
  );

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists create_profile_for_auth_user on auth.users;
create trigger create_profile_for_auth_user
after insert on auth.users
for each row
execute function public.create_profile_for_auth_user();

drop policy if exists "Users can delete their own profile" on public.profiles;
