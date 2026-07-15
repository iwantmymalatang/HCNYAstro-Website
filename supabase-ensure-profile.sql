-- Run this once in Supabase SQL Editor.
-- It keeps one stable profile row per signed-in user and preserves their username.

create or replace function public.normalize_username(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(value, ''))), '\s+', ' ', 'g'), '');
$$;

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  display_name text := coalesce(nullif(split_part(user_email, '@', 1), ''), 'Contributor');
  display_key text;
  saved_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if user_email <> 'hcnyastro@gmail.com' and public.normalize_username(display_name) like '%admin%' then
    display_name := trim(regexp_replace(display_name, 'admin', 'member', 'gi'));
  end if;
  display_key := public.normalize_username(display_name);
  if exists (
    select 1
    from public.profiles
    where username_key = display_key
      and id <> auth.uid()
  ) then
    display_name := concat(display_name, ' ', left(auth.uid()::text, 8));
  end if;

  insert into public.profiles (id, email, username, role)
  values (
    auth.uid(),
    user_email,
    display_name,
    case when user_email = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end
  )
  on conflict (id) do update
  set email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      role = case when excluded.email = 'hcnyastro@gmail.com' then 'admin' else public.profiles.role end,
      updated_at = now()
  returning * into saved_profile;

  return saved_profile;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
