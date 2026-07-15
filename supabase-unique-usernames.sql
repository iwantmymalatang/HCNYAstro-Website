-- Run this once in Supabase SQL Editor.
-- Usernames become unique, and only hcnyastro@gmail.com can use "admin" in a username.

alter table public.profiles add column if not exists username_key text;

create or replace function public.normalize_username(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(value, ''))), '\s+', ' ', 'g'), '');
$$;

drop index if exists public.profiles_username_key_unique;

update public.profiles
set username = coalesce(nullif(trim(username), ''), nullif(split_part(email, '@', 1), ''), 'Contributor')
where username is null or trim(username) = '';

update public.profiles
set username = trim(regexp_replace(username, 'admin', 'member', 'gi'))
where public.normalize_username(username) like '%admin%'
  and lower(coalesce(email, '')) <> 'hcnyastro@gmail.com';

with ranked as (
  select
    id,
    username,
    row_number() over (
      partition by public.normalize_username(username)
      order by created_at nulls last, id
    ) as duplicate_number
  from public.profiles
  where public.normalize_username(username) is not null
)
update public.profiles p
set username = concat(p.username, ' ', left(p.id::text, 8))
from ranked r
where p.id = r.id
  and r.duplicate_number > 1;

update public.profiles
set username_key = public.normalize_username(username)
where username is not null;

create unique index if not exists profiles_username_key_unique
on public.profiles (username_key)
where username_key is not null;

create or replace function public.set_profile_username_key()
returns trigger
language plpgsql
as $$
begin
  new.username_key := public.normalize_username(new.username);

  if new.username_key is not null
    and new.username_key like '%admin%'
    and lower(coalesce(new.email, '')) <> 'hcnyastro@gmail.com'
  then
    raise exception 'Username cannot include admin';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profile_username_key on public.profiles;
create trigger set_profile_username_key
before insert or update of username, email
on public.profiles
for each row execute function public.set_profile_username_key();
