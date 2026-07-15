-- Trust moderation for HCNYAstro forum.
-- Run this once in Supabase SQL Editor after deploying the site code.

alter table public.profiles
add column if not exists trust_status text not null default 'untrusted';

alter table public.profiles
add column if not exists settings_completed boolean not null default false;

alter table public.profiles drop constraint if exists profiles_trust_status_check;
alter table public.profiles
add constraint profiles_trust_status_check check (trust_status in ('trusted', 'untrusted'));

update public.profiles
set trust_status = case when lower(coalesce(email, '')) = 'hcnyastro@gmail.com' then 'trusted' else coalesce(trust_status, 'untrusted') end,
    settings_completed = case when lower(coalesce(email, '')) = 'hcnyastro@gmail.com' then true else coalesce(settings_completed, false) end,
    role = case when lower(coalesce(email, '')) = 'hcnyastro@gmail.com' then 'admin' else role end;

alter table public.forum_threads
add column if not exists status text;

update public.forum_threads
set status = 'approved'
where status is null;

alter table public.forum_threads
alter column status set default 'pending';

alter table public.forum_threads
alter column status set not null;

alter table public.forum_threads drop constraint if exists forum_threads_status_check;
alter table public.forum_threads
add constraint forum_threads_status_check check (status in ('pending', 'approved', 'rejected'));

update public.forum_threads
set status = 'approved'
where status not in ('pending', 'approved', 'rejected');

create or replace function public.is_trusted()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and trust_status = 'trusted'
    );
$$;

grant execute on function public.is_trusted() to authenticated;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, old.email, '')) = 'hcnyastro@gmail.com' then
    new.role := 'admin';
    new.trust_status := 'trusted';
  elsif not public.is_admin() then
    new.email := old.email;
    new.role := old.role;
    new.trust_status := old.trust_status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Contributor'
  );
  display_key text;
begin
  display_name := case
    when lower(new.email) <> 'hcnyastro@gmail.com' and public.normalize_username(display_name) like '%admin%'
      then trim(regexp_replace(display_name, 'admin', 'member', 'gi'))
    else display_name
  end;
  display_key := public.normalize_username(display_name);
  if exists (
    select 1
    from public.profiles
    where username_key = display_key
      and id <> new.id
  ) then
    display_name := concat(display_name, ' ', left(new.id::text, 8));
  end if;

  insert into public.profiles (id, email, username, role, trust_status, settings_completed)
  values (
    new.id,
    lower(new.email),
    display_name,
    case when lower(new.email) = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end,
    case when lower(new.email) = 'hcnyastro@gmail.com' then 'trusted' else 'untrusted' end,
    lower(new.email) = 'hcnyastro@gmail.com'
  )
  on conflict (id) do update
  set email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      role = case when lower(excluded.email) = 'hcnyastro@gmail.com' then 'admin' else public.profiles.role end,
      trust_status = case when lower(excluded.email) = 'hcnyastro@gmail.com' then 'trusted' else public.profiles.trust_status end,
      updated_at = now();

  return new;
end;
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

  insert into public.profiles (id, email, username, role, trust_status, settings_completed)
  values (
    auth.uid(),
    user_email,
    display_name,
    case when user_email = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end,
    case when user_email = 'hcnyastro@gmail.com' then 'trusted' else 'untrusted' end,
    user_email = 'hcnyastro@gmail.com'
  )
  on conflict (id) do update
  set email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      role = case when excluded.email = 'hcnyastro@gmail.com' then 'admin' else public.profiles.role end,
      trust_status = case when excluded.email = 'hcnyastro@gmail.com' then 'trusted' else public.profiles.trust_status end,
      updated_at = now()
  returning * into saved_profile;

  return saved_profile;
end;
$$;

drop view if exists public.forum_threads_with_counts;
create view public.forum_threads_with_counts as
select
  t.id,
  t.type,
  t.title,
  t.slug,
  t.body,
  t.image_url,
  t.tags,
  t.username,
  t.created_by,
  t.status,
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
where t.status = 'approved'
group by t.id;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Forum threads are public" on public.forum_threads;
drop policy if exists "Forum threads are visible when approved or owned" on public.forum_threads;
create policy "Forum threads are visible when approved or owned"
on public.forum_threads
for select
using (status = 'approved' or created_by = auth.uid() or public.is_admin());

drop policy if exists "Contributors create forum threads" on public.forum_threads;
create policy "Contributors create forum threads"
on public.forum_threads
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    status = 'pending'
    or (status = 'approved' and public.is_trusted())
  )
);

drop policy if exists "Contributors edit own threads or admin edits all" on public.forum_threads;
create policy "Contributors edit own threads or admin edits all"
on public.forum_threads
for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and (
      status = 'pending'
      or (status = 'approved' and public.is_trusted())
    )
  )
);

drop policy if exists "Contributors create comments" on public.forum_comments;
drop policy if exists "Trusted contributors create comments" on public.forum_comments;
create policy "Trusted contributors create comments"
on public.forum_comments
for insert
to authenticated
with check (created_by = auth.uid() and public.is_trusted());

drop policy if exists "Contributors vote on comments" on public.forum_comment_votes;
drop policy if exists "Trusted contributors vote on comments" on public.forum_comment_votes;
create policy "Trusted contributors vote on comments"
on public.forum_comment_votes
for insert
to authenticated
with check (user_id = auth.uid() and public.is_trusted());

grant select on public.forum_threads_with_counts to anon, authenticated;
