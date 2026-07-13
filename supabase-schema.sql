create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('member', 'contributor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'member' where role = 'viewer';
alter table public.profiles alter column role set default 'member';
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'contributor', 'admin'));

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  tags text[] not null default '{}',
  body text not null,
  image_url text,
  image_alt text,
  author text default 'HCNY Astronomy',
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.posts add column if not exists tags text[] not null default '{}';

insert into public.posts (
  title,
  slug,
  summary,
  tags,
  body,
  image_url,
  image_alt,
  author,
  published,
  created_at,
  updated_at
)
values
(
  'Results for AstroChallenge 2025',
  'results-for-astrochallenge-2025',
  'HCNY Astro members participated in AstroChallenge 2025 and earned Outstanding Project (Silver) plus third overall.',
  array['competition', 'astrochallenge', 'olympiad'],
  $$**Context**

Astrochallenge is an astronomy competition jointly organised by the astronomical societies of NUS and NTU. It aims to enhance students' interest and knowledge in astronomy, and hopes to foster closer inter-school ties through the common interest of astronomy. Students will be exposed to a comprehensive array of questions that range from theoretical to practical astronomy. The competition consists of several rounds for Junior Category: Individual round, Team round, and Project round.

**Experience**

In June 2025, a team consisting of 4 HCNY Astro members - Ngiam Hui En, Emma Zhang, Alyssa Tay, and Ng Chyng Yi participated in Astrochallenge. We were awarded Outstanding Project (Silver) and placed third overall.

In the Project round, we created a poster about the Voyager 1 Golden Records.

Over at the team round, we tackled questions like: What would happen if someone played Valorant and got so mad that she punched the Earth so hard it tilted?

The competition taught us what an open mind and a spirit of inquiry can do - tackling complex and unfamiliar problems and turning them into meaningful learning opportunities.$$,
  null,
  null,
  'HCNY Astronomy',
  true,
  '2026-06-29T00:00:00+08:00',
  now()
),
(
  'Collaboration with Raffles Institution Science and Astronomy Club',
  'ri-collab-post',
  'HCNY Astro collaborated with Raffles Institution students for astronomy activities, jeopardy, and outdoor stargazing.',
  array['collaboration', 'stargazing', 'outreach'],
  $$On 27 Feb, HCNY Astro had the pleasure of collaborating with students from Raffles Institution at the latter's campus, bringing around 60 students from the 3 schools. It was a great chance for students with a shared passion for astronomy to interact and participate in interesting activities.

The main highlights of the collaboration are the astronomy-themed jeopardy game and outdoor stargazing. It was indeed memorable, as the game was met with friendly competition and telescopes were available to focus on celestial objects of the night sky.

Overall, the collaboration was both enjoyable and meaningful, strengthening friendships across schools while fostering a shared interest in astronomy. We look forward to more collaborations in the future.$$,
  '/HCNYAstro-Website/images/posts/ri-collab-2026.jpeg',
  'HCNY Astro and Raffles Institution Science and Astronomy Club collaboration group photo',
  'HCNY Astronomy',
  true,
  '2026-06-28T00:00:00+08:00',
  now()
)
on conflict (slug) do update
set title = excluded.title,
    summary = excluded.summary,
    tags = excluded.tags,
    body = excluded.body,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    author = excluded.author,
    published = excluded.published,
    updated_at = now();

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create or replace function public.is_contributor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('contributor', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'member')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  if new.email is not null then
    insert into public.subscribers (email, active, updated_at)
    values (lower(trim(new.email)), true, now())
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, role)
select id, email, 'member'
from auth.users
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

update public.profiles set role = 'member' where role = 'viewer';

insert into public.subscribers (email, active, updated_at)
select lower(trim(email)), true, now()
from auth.users
where email is not null
on conflict (email) do nothing;

create or replace function public.subscribe_member(input_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_email text := lower(trim(input_email));
begin
  if cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.';
  end if;

  insert into public.subscribers (email, active, unsubscribed_at, updated_at)
  values (cleaned_email, true, null, now())
  on conflict (email) do update
  set active = true,
      unsubscribed_at = null,
      updated_at = now();
end;
$$;

create or replace function public.unsubscribe_member(input_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscribers
  set active = false,
      unsubscribed_at = now(),
      updated_at = now()
  where unsubscribe_token = input_token;
end;
$$;

create or replace function public.subscribe_viewer(input_email text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.subscribe_member(input_email);
$$;

create or replace function public.unsubscribe_viewer(input_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select public.unsubscribe_member(input_token);
$$;

grant execute on function public.subscribe_member(text) to anon, authenticated;
grant execute on function public.unsubscribe_member(uuid) to anon, authenticated;
grant execute on function public.subscribe_viewer(text) to anon, authenticated;
grant execute on function public.unsubscribe_viewer(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Published posts are readable" on public.posts;
create policy "Published posts are readable"
on public.posts
for select
using (published = true);

drop policy if exists "Contributors can read all posts" on public.posts;
create policy "Contributors can read all posts"
on public.posts
for select
to authenticated
using (public.is_contributor());

drop policy if exists "Authenticated users can read all posts" on public.posts;

drop policy if exists "Contributors can create posts" on public.posts;
create policy "Contributors can create posts"
on public.posts
for insert
to authenticated
with check (public.is_contributor());

drop policy if exists "Authenticated users can create posts" on public.posts;

drop policy if exists "Contributors can update posts" on public.posts;
create policy "Contributors can update posts"
on public.posts
for update
to authenticated
using (public.is_contributor())
with check (public.is_contributor());

drop policy if exists "Authenticated users can update posts" on public.posts;

drop policy if exists "Contributors can delete posts" on public.posts;
create policy "Contributors can delete posts"
on public.posts
for delete
to authenticated
using (public.is_contributor());

drop policy if exists "Authenticated users can delete posts" on public.posts;

drop policy if exists "Contributors can read subscribers" on public.subscribers;
create policy "Contributors can read subscribers"
on public.subscribers
for select
to authenticated
using (public.is_contributor());

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Post images are public" on storage.objects;
create policy "Post images are public"
on storage.objects
for select
using (bucket_id = 'post-images');

drop policy if exists "Contributors can upload post images" on storage.objects;
create policy "Contributors can upload post images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'post-images' and public.is_contributor());

drop policy if exists "Authenticated users can upload post images" on storage.objects;

drop policy if exists "Contributors can update post images" on storage.objects;
create policy "Contributors can update post images"
on storage.objects
for update
to authenticated
using (bucket_id = 'post-images' and public.is_contributor())
with check (bucket_id = 'post-images' and public.is_contributor());

drop policy if exists "Authenticated users can update post images" on storage.objects;

-- To approve an account as a contributor, replace the email below and run:
-- update public.profiles set role = 'contributor' where email = 'student@example.com';
-- To make an owner/admin account, run:
-- update public.profiles set role = 'admin' where email = 'owner@example.com';
