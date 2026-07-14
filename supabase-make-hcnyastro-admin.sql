-- Run this in Supabase SQL Editor after hcnyastro@gmail.com has signed up once.
-- It makes hcnyastro@gmail.com the only admin and keeps everyone else as contributor.

insert into public.profiles (id, email, username, role, notifications_enabled)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'username', 'HCNY Astro'),
  'admin',
  true
from auth.users
where lower(email) = 'hcnyastro@gmail.com'
on conflict (id) do update
set
  email = excluded.email,
  username = coalesce(public.profiles.username, excluded.username, 'HCNY Astro'),
  role = 'admin',
  notifications_enabled = coalesce(public.profiles.notifications_enabled, true),
  updated_at = now();

update public.profiles
set role = 'contributor',
    updated_at = now()
where lower(coalesce(email, '')) <> 'hcnyastro@gmail.com'
  and role = 'admin';
